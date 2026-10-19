// Email sequences written from the member's own facts. Anything only the member knows stays in
// [brackets] so nothing is invented. Every email: subject, preview text, body, one button, and
// when it goes out. No fake deadlines, no result promises, prices per item or per job.

const { text, time } = require('../../_kit');

const KINDS = {
  welcome: { label: 'Welcome series', count: 5, trigger: 'Someone joins your list', automated: true },
  launch: { label: 'Launch week', count: 6, trigger: 'Dates before and after your launch', automated: false },
  cart: { label: 'Abandoned cart', count: 3, trigger: 'Someone starts checkout and does not finish', automated: true },
  nurture: { label: 'Nurture emails', count: 6, trigger: 'People on your list who have not bought yet', automated: true },
  winback: { label: 'Win-back emails', count: 3, trigger: 'Past customers who have not been back in a while', automated: false },
  newsletter: { label: 'Newsletter', count: 1, trigger: 'Everyone on your list, once a month', automated: false },
};

const P = (...lines) => lines.filter((l) => l != null && l !== false && String(l).trim() !== '').join('\n\n');
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
// "Water deeply" -> "water deeply", but "Saturday hours" and "BBQ night" keep their capitals.
const lower = (s) => (s && /^[A-Z][a-z]/.test(s) && !/^(I|Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|January|February|March|April|May|June|July|August|September|October|November|December)\b/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s || '');

// A button label that fits on a phone: 2 to 4 words, 24 characters at most.
function buttonFor(label, max = 24) {
  const t = text.oneLine(label);
  if (t.length <= max) return t;
  const words = t.split(' ');
  let out = '';
  for (const w of words) {
    if ((out ? `${out} ${w}` : w).length > max) break;
    out = out ? `${out} ${w}` : w;
  }
  return out.replace(/\s+(the|a|an|my|your|and|of|for|to)$/i, '') || t.slice(0, max);
}

function signoff(f) {
  if (f.first) return f.hasName ? `${f.first}\n${f.business}` : f.first;
  return f.hasName ? f.business : 'Talk soon';
}

function whoLine(f) {
  const where = f.city ? ` in ${f.city}` : '';
  if (!f.hasName) return f.first ? `Quick hello: I'm ${f.first}.${f.what ? ` ${cap(f.what)}.` : ''}` : `Quick hello: these emails come straight from me, and I read every reply.`;
  if (f.first) return `Quick hello: I'm ${f.first}, and I run ${f.business}${where}.${f.what ? ` ${cap(f.what)}.` : ''}`;
  return `Quick hello from ${f.business}${where}.${f.what ? ` ${cap(f.what)}.` : ''}`;
}

function priceLine(f) {
  if (f.priceText && f.offer) return `My ${f.offer} is ${f.priceText}.`;
  if (f.priceText) return `Prices start at ${f.priceText}.`;
  return '[Your price, per item or per job, and what it includes.]';
}

// ---------- welcome ----------
function welcome(f) {
  const pick = (k, list) => text.pickBy(`${f.seed}|w|${k}`, list);
  const thing = f.thing || '';
  const link = f.link || f.website || '';
  const ask = pick('ask', ["what made you sign up. Even one line helps me send you the right things.", `what you're planning right now. I read every reply.`, 'one question you have about this. I read every reply and answer them myself.']);
  return [
    {
      day: 0,
      when: 'Right after they sign up',
      subject: thing ? `Here's your ${thing}` : f.hasName ? `Welcome to ${f.business}` : 'Welcome, and thank you',
      preview: thing ? 'Plus a quick hello and what to expect' : "Here's what to expect from me",
      body: P(
        'Hi there,',
        thing ? `Thanks for signing up. Your ${thing} is ready: tap the button below to open it. Save this email so you can find it later.` : f.hasName ? `Thanks for joining the ${f.business} list.` : 'Thanks for joining my list.',
        whoLine(f),
        `Over the next week I'll send you a few short emails: the story behind ${f.business}, the questions people ask me most, and how ${f.verb === 'book' ? 'booking' : 'ordering'} works. After that, you'll hear from me when I have something worth sharing.`,
        `One favor: hit reply and tell me ${ask}`,
        signoff(f)
      ),
      button: thing ? buttonFor(`Open the ${thing}`) : 'Visit the shop',
      link,
    },
    {
      day: 1,
      when: '1 day after they sign up',
      subject: pick('s2', [`Why I started ${f.business}`, `How ${f.business} started`, `The story behind ${f.business}`]),
      preview: pick('p2', ['It started with one moment', 'The short version, I promise', 'And why I still love doing it']),
      body: P(
        'Hi there,',
        `People ask me how ${f.business} started, so here's the short version.`,
        '[The moment you decided to start, in two or three sentences. Where you were, what happened.]',
        `What I care about most is [the one thing you never cut corners on]. That's still how I run things today.`,
        `If you've got a story like that about ${f.niche || 'this'}, hit reply. I'd love to hear it.`,
        signoff(f)
      ),
      button: '',
      link: '',
    },
    {
      day: 3,
      when: '3 days after they sign up',
      subject: pick('s3', ['The questions people ask me most', 'Your questions, answered', 'What people ask before they order']).replace('order', f.verb),
      preview: 'Price, timing and how it works',
      body: P(
        'Hi there,',
        'Here are the questions I get most, with straight answers.',
        `How much is it?\n${priceLine(f)}`,
        `How far ahead should I ${f.verb}?\n[Your usual lead time, like "a week ahead for weekends".]`,
        `Where do you ${f.verb === 'book' ? 'work' : 'deliver'}?\n${f.city ? `I'm based in ${f.city}. [The area you cover or where you ship.]` : '[Your area, or where you ship.]'}`,
        `What if something isn't right?\n[What you do about it, like a redo or a refund of your fee. Only promise what you control.]`,
        'Got a question I missed? Just reply.',
        signoff(f)
      ),
      button: link ? 'See all the details' : '',
      link,
    },
    {
      day: 5,
      when: '5 days after they sign up',
      subject: pick('s5', [`How ${f.verb === 'book' ? 'booking' : 'ordering'} works`, `${f.verb === 'book' ? 'Booking' : 'Ordering'}, step by step`, `What happens when you ${f.verb}`]),
      preview: 'Three steps, start to finish',
      body: P(
        'Hi there,',
        `If you've wondered what it's like to ${f.verb} with me, here's every step.`,
        `1. You ${f.verb === 'book' ? 'pick a time' : 'pick what you want'}${link ? ' on my site' : ''} and tell me anything I should know.`,
        `2. I confirm the details with you, usually within [how fast you reply].`,
        `3. ${f.verb === 'book' ? 'I show up on time and do the work.' : 'I make it and get it to you on the day we agreed.'} [One detail people love about this step.]`,
        "That's it. No surprises on price, and if anything isn't right, tell me and I'll make it right.",
        signoff(f)
      ),
      button: link ? (f.verb === 'book' ? 'Pick a time' : 'Start your order') : '',
      link,
    },
    {
      day: 7,
      when: '7 days after they sign up',
      subject: pick('s7', [`Ready when you are`, `When you're ready to ${f.verb}`, `Here's how to ${f.verb}`]),
      preview: f.offer ? cap(text.clip(f.offer, 60)) : `Everything in one place`,
      body: P(
        'Hi there,',
        f.offer ? `If you've been thinking about it, here's my ${f.offer}.` : `If you've been thinking about it, here's how to ${f.verb} with me.`,
        priceLine(f),
        f.audience ? `It's made for ${text.clip(f.audience.charAt(0).toLowerCase() + f.audience.slice(1), 120)}.` : '',
        `Tap the button to ${f.verb}, or reply with your date and any questions. I answer every email myself.`,
        signoff(f),
        "P.S. Not the right time? No problem. You'll keep getting my emails, and you can unsubscribe anytime with the link below."
      ),
      button: f.verb === 'book' ? 'Book now' : 'Order now',
      link,
    },
  ];
}

// ---------- launch ----------
function launch(f) {
  const pick = (k, list) => text.pickBy(`${f.seed}|l|${k}`, list);
  const noun = ((f.launch || '').match(/\b(collection|line|box|boxes|class|classes|course|menu|series|drop|kit|set|range|bundle)$/i) || [])[1];
  const the = (x) => (noun && !/^(the|my|our)\s/i.test(x) ? `the ${x}` : x);
  const name = the(f.launchTitle || f.launch || 'the new collection');
  const nm = the(f.launch || 'it');
  const see = noun ? `See the ${noun.toLowerCase()}` : 'Take a look';
  const link = f.link || f.website || '';
  const on = f.dateText ? `on ${f.dateText}` : 'soon';
  const d = (n) => (f.date ? time.addDays(f.date, n) : '');
  const emails = [
    {
      day: -7,
      when: '7 days before launch',
      subject: pick('s1', [`Something new is coming ${on}`, `A first look at ${nm}`, `I've been working on something`]),
      preview: `${cap(nm)}, ${f.dateText || 'coming soon'}`,
      body: P(
        'Hi there,',
        `I've been working on something for a while and you're the first to hear: ${name} ${f.dateText ? `opens ${on}` : 'is almost ready'}.`,
        '[One or two sentences on what it is and why you made it.]',
        `I'll send you a closer look this week. Want something specific in it? Hit reply and tell me.`,
        signoff(f)
      ),
      button: '',
      link: '',
    },
    {
      day: -3,
      when: '3 days before launch',
      subject: pick('s2', [`Behind the scenes of ${nm}`, `How I made ${nm}`, `A peek at ${nm}`]),
      preview: 'What went into it',
      body: P(
        'Hi there,',
        `Here's a look at how ${name} came together.`,
        '[What you tested, changed or threw out along the way. Real details make this email.]',
        '[The part you are proudest of.]',
        f.dateText ? `It opens ${on}. I'll email you the moment it does.` : `I'll email you the moment it opens.`,
        signoff(f)
      ),
      button: '',
      link: '',
    },
    {
      day: -1,
      when: '1 day before launch',
      subject: `${cap(nm)} opens tomorrow`,
      preview: f.priceText ? `Here's what to know before it does` : 'Everything you need to know',
      body: P(
        'Hi there,',
        `Tomorrow's the day: ${name} opens${f.dateText ? ` ${on}` : ''} at [the time you open].`,
        `What it is: [one sentence].`,
        f.priceText ? `Price: [your price for it, per item].` : 'Price: [your price, per item].',
        "I'll send you the link as soon as it's open, so keep an eye on your inbox.",
        signoff(f)
      ),
      button: '',
      link: '',
    },
    {
      day: 0,
      when: 'Launch day',
      subject: pick('s4', [`${cap(nm)} is here`, `It's open: ${nm}`, `${cap(nm)} is live`]),
      preview: 'Tap in for the first look',
      body: P(
        'Hi there,',
        `${cap(name)} is open now. You were on the list, so you're hearing it first.`,
        '[What is in it, in two or three short lines.]',
        `Tap the button to see everything. Questions? Reply and I'll answer myself.`,
        signoff(f)
      ),
      button: see,
      link,
    },
    {
      day: 2,
      when: '2 days after launch',
      subject: `Your questions about ${nm}`,
      preview: 'The answers, all in one place',
      body: P(
        'Hi there,',
        `A few of you asked the same questions about ${name}, so here are the answers.`,
        `[Question 1]\n[Your answer]`,
        `[Question 2]\n[Your answer]`,
        `What if something isn't right?\n[What you do about it, like a replacement or a refund. Only promise what you control.]`,
        signoff(f)
      ),
      button: see,
      link,
    },
    f.closeDate
      ? {
          day: Math.max(3, Math.round((Date.parse(f.closeDate) - Date.parse(f.date || f.closeDate)) / 86400000) - 1),
          when: 'The day before orders close',
          subject: `Orders for ${nm} close ${f.closeText.split(',')[0]}`,
          preview: `${f.closeText} is the last day`,
          body: P('Hi there,', `A heads-up: orders for ${name} close on ${f.closeText}. After that, [what happens: when it comes back, or that it won't].`, "If you've been meaning to grab one, the link is below.", signoff(f)),
          button: see,
          link,
        }
      : {
          day: 5,
          when: '5 days after launch',
          subject: pick('s6', [`Thank you, and a quick note on ${nm}`, `How ${nm} is going`, `A thank you`]),
          preview: 'And the link, in case you missed it',
          body: P('Hi there,', `Thank you for all the replies about ${name}. [One real thing someone told you, with their OK.]`, "If you missed it, everything is at the link below. No rush: it's there when you're ready.", signoff(f)),
          button: see,
          link,
        },
  ];
  return emails.map((e) => ({ ...e, date: d(e.day) }));
}

// ---------- abandoned cart ----------
function cart(f) {
  const pick = (k, list) => text.pickBy(`${f.seed}|c|${k}`, list);
  const link = f.link || '[Your checkout link]';
  return [
    {
      day: 0,
      hours: 1,
      when: '1 hour after checkout starts',
      subject: pick('s1', ['You left something in your cart', 'Your cart is saved', 'Still want this?']),
      preview: "It's saved for you",
      body: P('Hi there,', `Looks like you started an order with ${f.business} and didn't finish. No problem: your cart is saved.`, 'Tap the button to pick up where you left off.', 'If something went wrong at checkout, reply and tell me. I will sort it out.', signoff(f)),
      button: 'Back to my cart',
      link,
    },
    {
      day: 1,
      hours: 24,
      when: '1 day after checkout starts',
      subject: pick('s2', ['Any questions before you order?', 'Quick answers before you order', 'Anything I can help with?']),
      preview: 'Shipping, returns and more',
      body: P(
        'Hi there,',
        'Sometimes a question gets in the way of an order, so here are the ones people ask most.',
        `Shipping\n${f.shipping ? `${cap(f.shipping)}.` : '[How you ship or deliver, and how long it takes.]'}`,
        `If something isn't right\n${f.returns ? `${cap(f.returns)}.` : '[Your return or replacement policy.]'}`,
        'Anything else? Reply and you get me, not a robot.',
        signoff(f)
      ),
      button: 'Finish my order',
      link,
    },
    {
      day: 3,
      hours: 72,
      when: '3 days after checkout starts',
      subject: f.discount ? pick('s3d', ['A little something for your order', 'Here is something for your cart']) : pick('s3', ['Still thinking it over?', 'Your cart is still here']),
      preview: f.discount ? text.clip(cap(f.discount), 80) : 'No pressure, just a reminder',
      body: P(
        'Hi there,',
        f.discount ? `Your cart is still saved. If it helps you decide: ${f.discount}.` : 'Your cart is still saved, in case you want to come back to it.',
        "This is the last reminder I'll send about it. If now isn't the time, no problem.",
        signoff(f)
      ),
      button: 'See my cart',
      link,
    },
  ];
}

// ---------- nurture ----------
// What the member typed ("tips, a mistake you see a lot, the question people ask most"), sorted.
function sortTips(lines) {
  const out = { tips: [], mistakes: [], questions: [] };
  for (const raw of lines || []) {
    const l = text.oneLine(raw).replace(/^[-*\d.)\s]+/, '').trim();
    if (!l) continue;
    if (/\?$/.test(l)) out.questions.push(l);
    else if (/^(don'?t|never|stop|avoid|skip|forget)\b|\bmistakes?\b|\bwrong\b/i.test(l)) out.mistakes.push(l);
    else out.tips.push(l.replace(/[.!]+$/, ''));
  }
  return out;
}

function nurture(f) {
  const pick = (k, list) => text.pickBy(`${f.seed}|n|${k}`, list);
  const topic = f.topic || f.niche || '';
  const { tips, mistakes, questions } = sortTips(f.tips);
  const link = f.link || f.website || '';
  const visit = f.verb === 'book' ? 'book anyone' : 'buy';
  const q1 = questions[0] || '';
  const asks =
    f.verb === 'book'
      ? ['What exactly is included in the price, and can I have it in writing?', "What happens if something isn't right?"]
      : ["What's it made of, and where is it made?", "What happens if it arrives damaged or isn't right?"];
  return [
    {
      day: 0,
      when: 'When they start this sequence',
      subject: topic && topic.length <= 40 ? pick('s1', [`A quick tip for ${topic}`, `One tip for ${topic}`, `Something that helps with ${topic}`]) : `A quick tip from ${f.business}`,
      preview: pick('p1', ['Short, useful, and you can use it this week', 'The first thing I tell every customer', 'It takes two minutes']),
      body: P(
        'Hi there,',
        `Here's something I tell almost every customer: ${tips[0] ? `${lower(tips[0])}.` : `[one tip${topic ? ` for ${topic}` : ''} they can use this week, in a sentence or two].`}`,
        '[Why it helps, in one sentence.]',
        `Over the next few weeks I'll send you a few more like this, one a week, short and useful.`,
        'Got a question? Hit reply. I read every one.',
        signoff(f)
      ),
      button: '',
      link: '',
    },
    {
      day: 7,
      when: '1 week later',
      subject: pick('s2', ['The mistake I see most', 'A common mistake, and the fix', 'What I wish more people knew']),
      preview: 'And what to do instead',
      body: P(
        'Hi there,',
        `The mistake I see most: ${mistakes[0] ? `${lower(mistakes[0]).replace(/[.!]+$/, '')}.` : '[the mistake, in one sentence].'}`,
        'Why it happens: [one sentence].',
        'What to do instead: [the fix, in one or two sentences].',
        "Not sure if this is you? Reply and tell me what you're seeing. I'll give you a straight answer.",
        signoff(f)
      ),
      button: '',
      link: '',
    },
    {
      day: 14,
      when: '2 weeks later',
      subject: pick('s3', ['What it looks like done right', 'A quick story from this month', 'How one customer did it']),
      preview: 'A real one, shared with permission',
      body: P(
        'Hi there,',
        'A quick story.',
        '[A customer you helped, first name only and with their OK: what they needed, what you did and how it turned out.]',
        'What made the difference: [the one thing you do that others skip].',
        "That's the part I never cut corners on.",
        signoff(f)
      ),
      button: '',
      link: '',
    },
    {
      day: 21,
      when: '3 weeks later',
      subject: q1 && q1.length <= 60 ? q1.replace(/[!?]+$/, '') : pick('s4', ['The question I get most', 'Your question, answered', 'What people ask me most']),
      preview: 'The straight answer',
      body: P(
        'Hi there,',
        `The question I get asked most: ${q1 || '[the question, in their words]'}`,
        "My answer: [your answer in 3 to 5 sentences, the way you'd say it out loud].",
        "If your situation is different, reply and ask. That's what I'm here for.",
        signoff(f)
      ),
      button: '',
      link: '',
    },
    {
      day: 28,
      when: '4 weeks later',
      subject: pick('s5', [`What to ask before you ${visit}`, 'Three questions worth asking first', 'How to choose well']),
      preview: 'Ask these, whoever you choose',
      body: P(
        'Hi there,',
        'Whoever you choose, here are three questions worth asking first.',
        `1. ${asks[0]}`,
        `2. ${asks[1]}`,
        '3. [A question only someone who really knows the work can answer well.]',
        `My answers: ${priceLine(f)} [What's included, and that you'll put it in writing.] [What you do if something isn't right.] [Your answer to question 3.]`,
        signoff(f)
      ),
      button: '',
      link: '',
    },
    {
      day: 35,
      when: '5 weeks later',
      subject: pick('s6', ['Ready when you are', `When you're ready to ${f.verb}`, 'An easy next step']),
      preview: f.offer ? cap(text.clip(f.offer, 60)) : 'Here is how it works',
      body: P(
        'Hi there,',
        "You've had a few emails from me now, so here's the simple version of how to work with me.",
        f.offer && !f.priceText ? `My ${f.offer}: [the price, and what it includes].` : priceLine(f),
        `Tap the button to ${f.verb}, or reply with a question first. Either way, you'll hear back from me.`,
        signoff(f),
        "P.S. Not now? No problem. I'll keep sending one useful email [how often you send], and you can unsubscribe anytime with the link below."
      ),
      button: f.verb === 'book' ? 'Book a time' : 'Shop now',
      link,
    },
  ];
}

// ---------- win-back ----------
function winback(f) {
  const pick = (k, list) => text.pickBy(`${f.seed}|b|${k}`, list);
  const link = f.link || f.website || '';
  const visit = f.verb === 'book' ? 'visit' : 'order';
  const d = (n) => (f.start ? time.addDays(f.start, n) : '');
  return [
    {
      day: 0,
      when: 'Day 1',
      subject: pick('s1', ["It's been a while", `A quick hello from ${f.business}`, 'Thinking of you']),
      preview: pick('p1', [`Here's what's new since your last ${visit}`, 'And what has changed since then', "Just a hello, and what's new"]),
      body: P(
        'Hi there,',
        `It's been a while since your last ${visit}, so I wanted to say hello.`,
        f.news ? `Here's what's new since then: ${lower(f.news)}.` : "[What's new since they last came: a new service, product, hours, or something you improved.]",
        `If anything about your last ${visit} wasn't right, reply and tell me. I want to know.`,
        `And if you're ready for another, the button below is the quickest way.`,
        signoff(f)
      ),
      button: f.verb === 'book' ? 'Book again' : 'Shop again',
      link,
    },
    f.discount
      ? {
          day: 4,
          when: '4 days later',
          subject: pick('s2d', ['Something for your next visit', 'A welcome-back offer for you']).replace('visit', visit),
          preview: text.clip(cap(f.discount), 80),
          body: P(
            'Hi there,',
            `A thank-you for being a customer before: ${lower(f.discount)}.`,
            "No pressure: it's there if you want it. Tap the button, or reply and I'll set it up for you.",
            signoff(f)
          ),
          button: f.verb === 'book' ? 'Book my visit' : 'Use my offer',
          link,
        }
      : {
          day: 4,
          when: '4 days later',
          subject: pick('s2', ['An easy way back', `Your next ${visit}, made easy`, 'Whenever you are ready']),
          preview: 'It takes a minute',
          body: P(
            'Hi there,',
            `Coming back is easy: ${f.verb === 'book' ? 'pick a time that suits you' : 'pick what you want'}${link ? ' with the button below' : ''}, and I'll take it from there.`,
            '[One reason now is a good time, only if it is true: the season, the weather, a busy month coming.]',
            'Questions first? Reply to this email. It comes straight to me.',
            signoff(f)
          ),
          button: f.verb === 'book' ? 'Pick a time' : 'Shop now',
          link,
        },
    {
      day: 10,
      when: '10 days after the first',
      subject: pick('s3', ['Should I keep emailing you?', 'Still want to hear from me?', 'Do you still want these emails?']),
      preview: 'One tap, either way',
      body: P(
        'Hi there,',
        "I don't want to fill your inbox with emails you don't read.",
        'If you want to keep hearing from me, tap the button below. That is all it takes.',
        "If not, no hard feelings. The unsubscribe link is at the bottom of this email, and you'll stop hearing from me.",
        signoff(f)
      ),
      button: 'Yes, keep me on the list',
      link,
    },
  ].map((e) => ({ ...e, date: d(e.day) }));
}

// ---------- newsletter ----------
function newsletter(f) {
  const pick = (k, list) => text.pickBy(`${f.seed}|m|${f.month}|${k}`, list);
  const link = f.link || f.website || '';
  const news = (f.newsLines || []).map((x) => text.oneLine(x).replace(/^[-*\d.)\s]+/, '').replace(/[.!]+$/, '')).filter(Boolean).slice(0, 4);
  return [
    {
      day: 0,
      when: `${f.month} issue`,
      subject: pick('s', [`What's new at ${f.business} this ${f.month}`, `${f.business} news for ${f.month}`, `Your ${f.month} note from ${f.business}`, `${f.month} at ${f.business}`]),
      preview: news[0] ? text.clip(cap(news[0]), 80) : pick('p', ["What's new, one tip, and what's coming up", 'A short note, a tip and a few dates', "One tip and what's new this month"]),
      body: P(
        'Hi there,',
        '[A line or two about your month: something you noticed, made or learned.]',
        `What's new\n${news.length ? news.map((x) => `${cap(x)}.`).join('\n') : '[A new service, product, hours or team member. One line each.]'}`,
        `This month's tip\n${f.tip ? `${cap(f.tip.replace(/[.!]+$/, ''))}.` : `[One tip your customers can use this month, in two or three sentences.]`}`,
        `Coming up\n${f.coming ? `${cap(f.coming.replace(/[.!]+$/, ''))}.` : '[A date to know: an event, a holiday schedule or a seasonal reminder.]'}`,
        `Want to ${f.verb}? Tap the button, or reply to this email. I read every reply.`,
        signoff(f)
      ),
      button: f.verb === 'book' ? 'Book a time' : 'Shop now',
      link,
      date: '',
    },
  ];
}

function sequenceFor(kind, f) {
  const make = { launch, cart, nurture, winback, newsletter }[kind] || welcome;
  const list = make(f);
  return list.map((e, i) => ({ key: `email${i + 1}`, n: i + 1, time: '09:00', hours: e.hours != null ? e.hours : e.day * 24, ...e, subject: text.oneLine(e.subject), preview: text.oneLine(e.preview) }));
}

// The editable form a member sees in the approve step, and back.
function toText(e) {
  return `Subject: ${e.subject}\nPreview: ${e.preview}\n\n${e.body}`;
}

function fromText(raw, base = {}) {
  const s = String(raw || '').replace(/\r\n/g, '\n');
  const subject = (s.match(/^\s*Subject:\s*(.+)$/im) || [])[1];
  const preview = (s.match(/^\s*Preview(?: text)?:\s*(.+)$/im) || [])[1];
  const body = s.replace(/^\s*Subject:.*$/im, '').replace(/^\s*Preview(?: text)?:.*$/im, '').replace(/^\n+/, '').trim();
  return { ...base, subject: text.oneLine(subject || base.subject || ''), preview: text.oneLine(preview || base.preview || ''), body: body || base.body || '' };
}

module.exports = { KINDS, sequenceFor, toText, fromText, buttonFor, sortTips };
