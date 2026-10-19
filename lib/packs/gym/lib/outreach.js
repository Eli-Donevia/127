// The messages. Drafts only: the member reads, edits and sends them from their own Instagram,
// email or phone (contract section 5: nothing reaches a real person without the member).
// Built so they work with no AI at all; when ctx.ai is there, it rewrites them around the gym's facts.
// Rules baked in: the member is the sender; no prices, results or claims in a first message;
// email carries the sender's postal address and a way to opt out (CAN-SPAM, US); one follow-up a week,
// stop at "no"; the sample is sent privately to the gym and never posted.

const { plain, shortSite, money } = require('./util');
const { OFFER_LABEL, CATEGORY_LABEL } = require('./gaps');

function firstNameOf(person) {
  if (!person || !person.name) return null;
  return String(person.name).trim().split(/\s+/)[0] || null;
}

const ADDRESS_LINE = '[Your business address, required in marketing email]';
const OPT_OUT = 'Not interested? Reply "no thanks" and I won\'t email again.';

// How every sales email in the sequence ends, follow-ups included: the member's name, their business,
// a postal address and a way to opt out. US CAN-SPAM treats each email as its own message (Legal L55).
// The [address] placeholder keeps HQ's Copy off until it's filled in (G35).
function emailFooter(member = {}, business = {}) {
  return ['', '', member.firstName || '[your name]', business.name || null, ADDRESS_LINE, '', OPT_OUT].filter((l) => l !== null).join('\n');
}

function withEmailFooter(text, footer) {
  if (String(text || '').includes(ADDRESS_LINE)) return String(text);
  const name = footer.split('\n').find((l) => l.trim()) || '';
  // A sign-off already on the text would read twice.
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const body = String(text || '').replace(new RegExp(`\\n+[ \\t]*-?[ \\t]*${esc}[ \\t]*\\.?[ \\t]*$`), '').trimEnd();
  return body + footer;
}

// The same follow-up as a DM: no address or opt-out lines.
function withoutEmailFooter(text) {
  const t = String(text || '');
  const i = t.lastIndexOf(`\n${ADDRESS_LINE}`);
  if (i < 0) return t;
  // Back up over the name (and business) lines that sit right above the address.
  const head = t.slice(0, i).split('\n');
  while (head.length && head[head.length - 1].trim()) head.pop();
  return head.join('\n').trimEnd();
}

// facts: { gym, score, report, video, member, business, city }
function drafts(facts) {
  const { gym, score = {}, report = {}, member = {}, business = {} } = facts;
  const owner = score.contact && score.contact.owner;
  const hi = firstNameOf(owner) ? `Hi ${firstNameOf(owner)}` : `Hi ${gym.name} team`;
  // No name on file: a placeholder, so HQ keeps Copy off until it's filled (never "I'm there").
  const me = member.firstName || '[your name]';
  const biz = business.name ? ` from ${business.name}` : '';
  const footer = emailFooter(member, business);
  // The member's own city (never the gym's: a suburb gym would read "here in" a town the member isn't in).
  const city = facts.city || '';
  const opener = openerWithVideo(facts) || report.opener || `I made a short sample Reel for ${gym.name} to show what I do.`;
  // No sample yet (the render failed or was skipped): every line offers one instead of pointing at
  // an attachment that isn't there.
  const hasSample = !!facts.video;
  const q = hasSample ? null : quickDrafts(facts);
  const gaps = report.gaps || [];
  const ideas = report.ideas || [];
  const idea = ideas[0];
  const label = CATEGORY_LABEL[gym.category] || 'gym';
  const site = gym.website ? shortSite(gym.website) : null;
  const ig = score.contact && score.contact.instagram;
  const offer = facts.offer && facts.offer.kind !== 'none' ? facts.offer : null;
  const riskLine = riskLineFor(facts.memberOffer);

  const what = offer ? `ad for your ${OFFER_LABEL[offer.kind] || 'intro offer'}` : 'Reel of one of your classes';
  const dm = q
    ? q.dm
    : plain(
        `${hi}, I'm ${me}${biz}, ${city ? `a video editor here in ${city}` : 'a local video editor'}. ${opener} It's attached, 15 seconds, made for you. ` +
          `No catch: if you like it, it's yours to post. If you want more like it, I can make you a few every month. Want me to send the full-quality file?`
      );

  const subject = q ? q.email.subject : plain(`Made this for ${gym.name}`);
  const email = q ? q.email.body : plain(
    [
      `${hi},`,
      '',
      `I'm ${me}${biz}, ${city ? `a video editor in ${city}` : 'a local video editor'}. ${opener}`,
      '',
      `The sample is attached (15 seconds, vertical, ready for Instagram and TikTok).${noticed(facts, gaps) ? ` One more thing I noticed: ${noticed(facts, gaps)}.` : ''}`,
      '',
      idea ? `If it's useful, my next one for you would be "${idea.title}": ${idea.shots}` : '',
      '',
      'Would it be worth a 10-minute chat this week? If not, no worries at all.',
    ]
      .filter((l, i, a) => !(l === '' && a[i - 1] === ''))
      .join('\n')
      .trimEnd() + footer
  );

  const walkIn = q
    ? plain(
        [
          `Best time: mid-morning or early afternoon on a weekday, between classes. Ask the front desk: "Is ${firstNameOf(owner) || 'the owner'} in?"`,
          `Then: "I'm ${me}, a local video editor. I'd like to make ${gym.name} a free 15-second ${what}, no strings. Could I film part of a class next week?${riskLine ? ` ${riskLine}` : ''}"`,
          "If they're out: ask who looks after their Instagram, and the best email for the owner.",
          'Write down who you spoke to and when. Follow up in 3 days.',
        ].join('\n')
      )
    : plain(
    [
      `Best time: mid-morning or early afternoon on a weekday, between classes. Ask the front desk: "Is ${firstNameOf(owner) || 'the owner'} in? I'm a local video editor and I made something for the gym."`,
      `If they're in: "I'm ${me}. I made this for ${gym.name}," then play the sample on your phone, volume up. Stop talking while it plays.`,
      `Then: "${opener} Could I film one class next week and make you three of these?${riskLine ? ` ${riskLine}` : ''}"`,
      'If they\'re out: leave a card with a QR code to the sample, and ask for the best email for the owner.',
      'Write down who you spoke to and when. Follow up in 3 days.',
    ].join('\n')
  );

  const voicemail = plain(
    q
      ? `Hi, this is ${me}${biz}, ${city ? `a video editor in ${city}` : 'a local video editor'}. I'd like to make ${gym.name} a free 15-second ${what}, no strings. I'll send ${ig ? `a message to your Instagram, @${ig}` : 'you an email'} with the details. My number is [your number]. Thanks!`
      : `Hi, this is ${me}${biz}, ${city ? `a video editor in ${city}` : 'a local video editor'}. I made a short sample Reel for ${gym.name}, free, no strings. I'll send it to ${ig ? `your Instagram, @${ig}` : 'your email'} so you can take a look. My number is [your number]. Thanks!`
  );

  const followUps = [
    {
      day: 3,
      channel: ig ? 'Instagram DM' : 'Email',
      text: plain(
        q
          ? `Hey, just floating this back up in case it got buried. Happy to make one short video for ${gym.name}, free. Want it?`
          : `Hey, just floating this back up in case it got buried. Happy to make one more for ${gym.name}${idea ? `, maybe "${idea.title}"` : ''}, also free. Want it?`
      ),
    },
    {
      day: 7,
      channel: 'Email',
      text: plain(
        `${hi}, one quick video idea you can use even if we never work together: ${idea ? `${idea.title.toLowerCase()}. Open on "${idea.hook.replace(/[.!?]+$/, '')}", then film ${idea.shots.replace(/[.!?]+$/, '').toLowerCase()}` : 'film one class from start to finish and cut the best 15 seconds'}. Happy to edit it for you if you send me the clips.`
      ),
    },
    {
      day: 14,
      channel: ig ? 'Instagram DM' : 'Email',
      text: plain(`Last one from me. Should I close your file, or is video something you want to sort out later this year? Either answer is totally fine.`),
    },
  ].map((f) => (f.channel === 'Email' ? { ...f, text: withEmailFooter(f.text, footer) } : f));

  const mo = facts.memberOffer && facts.memberOffer.price ? facts.memberOffer : null;
  const howMuch = mo && mo.price.firstMonthFree
    ? `Right now I'm taking on ${mo.price.rung && mo.price.rung.slots ? mo.price.rung.slots : 3} gyms free for the first month, as case studies, so it may cost you nothing to try. Can I ask two quick questions first? How often do you post now, and who makes it?`
    : mo
      ? `I usually suggest starting at ${money(mo.price.current)} a month for ${mo.reels || 12} Reels from one shoot. Can I ask two quick questions first, so I suggest the right thing? How often do you post now, and who makes it?`
      : 'It depends on how many videos you want. Can I ask two quick questions first, so I suggest the right thing? How often do you post now, and who makes it?';
  const replies = [
    { when: 'How much?', say: plain(howMuch) },
    { when: 'Send me more info', say: plain(q ? "Here are 3 ideas I'd make for you this month. Want me to make the first one free, so you can see it before you decide anything?" : "Here are 3 ideas I'd make for you this month, with the first one already done (attached). Want to pick a day for me to film?") },
    { when: 'We do it in-house', say: plain('Makes sense. Want me to cut one from your existing clips anyway? If it\'s not better than what you post, I\'ll leave you alone.') },
    { when: 'Not right now', say: plain('No problem. Is it OK if I check back in two months?') },
    { when: 'No / stop', say: plain('Understood, thanks for looking. I won\'t message again. (Mark it lost and stop.)') },
  ];

  return {
    dm,
    email: { subject, body: email, to: score.contact && score.contact.email },
    emailFooter: footer,
    walkIn,
    voicemail,
    followUps,
    replies,
    rules: [
      `Before you send, open ${site || 'their site'} and their Instagram and make sure every line is still true.`,
      'Send it yourself, one gym at a time. No bulk DMs or auto-senders (Instagram bans them).',
      'Keep the sample private: send it to the gym, never post or tag it.',
      'Email: your business address and an opt-out line stay in (US CAN-SPAM).',
      'Don\'t cold-text a gym\'s cell number. Calls and walk-ins are fine.',
      'One follow-up a week, three at most. Stop at no.',
    ],
    offer: offer ? `${OFFER_LABEL[offer.kind]}: "${offer.text}"` : null,
    site,
  };
}

// The walk-in line that lowers the risk, from the member's own offer only. Never added on their behalf.
function riskLineFor(mo) {
  if (!mo) return null;
  if (mo.price && mo.price.firstMonthFree) return `I'm taking on ${mo.price.rung && mo.price.rung.slots ? mo.price.rung.slots : 3} gyms this month for free, as case studies.`;
  const g = mo.guarantee;
  if (!g) return null;
  if (g.kind === 'love_it' || g.kind === 'both') return "If you don't love them, you don't pay.";
  return null;
}

// When the sample is an ad for the gym's own intro offer, the pitch says so.
function openerWithVideo(facts) {
  const v = facts.video;
  const offer = facts.offer && facts.offer.kind !== 'none' ? facts.offer : null;
  if (!v || !v.template) return null;
  if (v.template === 'offer' && offer && v.realOffer !== false) return `I saw the ${OFFER_LABEL[offer.kind] || 'intro offer'} on your site and made a 15-second ad for it, so you can see it in motion.`;
  if (v.template === 'class' && (v.used ? v.used.clips || v.used.photos : true)) return `I made a 15-second Reel that shows what a class at ${facts.gym.name} feels like.`;
  return null;
}

// The first gap the opener didn't already use, said to the owner.
function noticed(facts, gaps) {
  const usedTop = !openerWithVideo(facts);
  const g = usedTop ? gaps[1] : gaps[0];
  return g && g.say ? g.say : null;
}

const capFirst = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

// The first message for a gym that has no sample yet (most of the member's list): it offers to make
// one. No attachment, no price, no claims. Built without AI, so all 25 gyms get one for free.
function quickDrafts(facts) {
  const { gym, score = {}, report = {}, member = {}, business = {} } = facts;
  const owner = score.contact && score.contact.owner;
  const hi = firstNameOf(owner) ? `Hi ${firstNameOf(owner)}` : `Hi ${gym.name} team`;
  // No name on file: a placeholder, so HQ keeps Copy off until it's filled (never "I'm there").
  const me = member.firstName || '[your name]';
  const biz = business.name ? ` from ${business.name}` : '';
  const city = facts.city || '';
  const offer = facts.offer && facts.offer.kind !== 'none' ? facts.offer : null;
  const gap = (report.gaps || []).find((g) => g.say);
  const observation = gap ? `I noticed ${gap.say}.` : `I make short videos for gyms${city ? ` in ${city}` : ''}.`;
  const what = offer ? `ad for your ${OFFER_LABEL[offer.kind] || 'intro offer'}` : 'Reel of one of your classes';
  const dm = plain(`${hi}, I'm ${me}${biz}, ${city ? `a video editor here in ${city}` : 'a local video editor'}. ${observation} I'd like to make ${gym.name} a free 15-second ${what}, no strings. If you like it, it's yours to post. Want me to?`);
  const subject = plain(`A free video for ${gym.name}?`);
  const email = plain(
    [
      `${hi},`,
      '',
      `I'm ${me}${biz}, ${city ? `a video editor in ${city}` : 'a local video editor'}. ${observation}`,
      '',
      `I'd like to make you a free 15-second ${what}. If you like it, it's yours to post. If not, no hard feelings.`,
      '',
      'Want me to make it this week?',
    ]
      .filter((l, i, a) => !(l === '' && a[i - 1] === ''))
      .join('\n')
      .trimEnd() + emailFooter(member, business)
  );
  const call = plain(`Hi, is this ${gym.name}? I'm ${me}, a local video editor. I'd like to make you a free 15-second ${what}, no strings. Who's the best person to send it to, and what's their email?`);
  const walkIn = plain(`Hi! I'm ${me}, a local video editor. I'd like to make ${gym.name} a free 15-second ${what}, no strings. Who looks after your Instagram, and when are they in?`);
  return { dm, email: { subject, body: email, to: score.contact && score.contact.email }, call, walkIn, observation: capFirst(observation) };
}

// The AI version: same facts, rewritten. Returns a prompt and schema for ctx.ai({ task: 'write' }).
const OUTREACH_SCHEMA = {
  type: 'object',
  properties: {
    dm: { type: 'string', maxLength: 600 },
    email_subject: { type: 'string', maxLength: 80 },
    email_body: { type: 'string', maxLength: 1600 },
    walk_in: { type: 'string', maxLength: 900 },
    follow_up_day3: { type: 'string', maxLength: 400 },
    follow_up_day7: { type: 'string', maxLength: 600 },
    follow_up_day14: { type: 'string', maxLength: 300 },
  },
  required: ['dm', 'email_subject', 'email_body', 'walk_in', 'follow_up_day3', 'follow_up_day7', 'follow_up_day14'],
};

const OUTREACH_SYSTEM = `You write first-contact messages for a freelance video editor pitching a local gym, studio or martial arts school.
The editor made a free 15-second sample Reel for this gym and is sending it privately.
Rules:
- The editor is the sender and speaks in first person. Use the editor's first name. Never mention 127 or anyone else.
- Use only the facts given. Every observation about the gym must come from the facts block. Never invent numbers, results, clients, testimonials or claims about what video will do for them.
- No prices, packages or discounts in any message. No fake urgency.
- Short and human: the DM under 70 words, the email under 150 words, follow-ups under 60 words. Plain text: no markdown, no emojis, no em dashes, no exclamation marks in a row.
- The email must end with the sender's name, then the line "[Your business address, required in marketing email]", then an opt-out line such as: Not interested? Reply "no thanks" and I won't email again.
- The walk-in script is what to say at the front desk and to the owner, in 3 to 5 short lines, with the moment to play the sample on a phone.
- Follow-ups: day 3 a light bump offering one more free sample, day 7 one useful idea they can use even without the editor, day 14 a polite close ("Should I close your file?"). No sign-off on follow-ups: the name, address and opt-out lines are added to the email ones for you.`;

function outreachPrompt(facts) {
  const { gym, score = {}, report = {}, member = {}, business = {} } = facts;
  const lines = [
    `Editor: ${member.firstName || 'the editor'}${business.name ? ` (${business.name})` : ''}${facts.city ? `, based in ${facts.city}` : ''}.`,
    `Gym: ${gym.name}, a ${CATEGORY_LABEL[gym.category] || 'gym'}${gym.city ? ` in ${gym.city}` : ''}.`,
    score.contact && score.contact.owner ? `Owner or manager named on their website: ${score.contact.owner.name} (${score.contact.owner.role}).` : 'No owner name known: greet the team.',
    facts.offer && facts.offer.kind !== 'none' ? `Their website offers: "${facts.offer.text}".` : 'No offer found on their website.',
    'What we checked and found (use one or two, the first is strongest):',
    ...(report.gaps || []).map((g, i) => `${i + 1}. ${g.title}: ${g.evidence}`),
    'Video ideas for them:',
    ...(report.ideas || []).map((i) => `- ${i.title}: opens with "${i.hook}"`),
    `The sample Reel attached: ${facts.videoTitle || 'a 15-second vertical Reel made for them'}.`,
  ];
  return { system: OUTREACH_SYSTEM, prompt: `Facts:\n${lines.join('\n')}\n\nWrite the messages.`, schema: OUTREACH_SCHEMA };
}

function mergeAi(base, ai) {
  if (!ai) return base;
  const ok = (s) => typeof s === 'string' && s.trim().length > 20;
  const out = { ...base, ai: true };
  if (ok(ai.dm)) out.dm = plain(ai.dm);
  if (ok(ai.email_body)) out.email = { ...base.email, subject: plain(ai.email_subject || base.email.subject), body: plain(ai.email_body) };
  if (ok(ai.walk_in)) out.walkIn = plain(ai.walk_in);
  const fu = [ai.follow_up_day3, ai.follow_up_day7, ai.follow_up_day14];
  // The legal lines stay, whatever the model wrote: every email follow-up ends like the first email.
  out.followUps = base.followUps.map((f, i) => (ok(fu[i]) ? { ...f, text: f.channel === 'Email' && base.emailFooter ? withEmailFooter(plain(fu[i]), base.emailFooter) : plain(fu[i]) } : f));
  if (!/address/i.test(out.email.body)) out.email.body += `\n${ADDRESS_LINE}`;
  if (!/no thanks|unsubscribe|won't email/i.test(out.email.body)) out.email.body += `\n${OPT_OUT}`;
  return out;
}

module.exports = { drafts, quickDrafts, riskLineFor, openerWithVideo, outreachPrompt, mergeAi, emailFooter, withEmailFooter, withoutEmailFooter, ADDRESS_LINE, OPT_OUT, OUTREACH_SCHEMA, OUTREACH_SYSTEM };
