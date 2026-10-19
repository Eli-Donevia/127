// A new customer's welcome kit: how it works (steps the member keeps or edits), how to get ready,
// the member's own policies (left out when none are given, never guessed), how to reach them, a
// printable welcome guide in the brand colors, and the welcome email and texts. Steps and tips are
// starting points by kind of business; the member ticks the ones that match how they work.

const { text, files } = require('../../_kit');
const L = require('./logos');

const esc = files.esc;

// Kind of business -> how a first job usually runs.
const GROUP = {
  detailing: 'onsite', washing: 'onsite', cleaning: 'onsite', lawn: 'onsite', pets: 'onsite', home_services: 'onsite',
  beauty: 'visit', photo: 'visit', fitness: 'visit',
  web: 'online', video: 'online', social: 'online', tech: 'online', content: 'online', coaching: 'online', templates: 'online',
  tutoring: 'lessons', kids: 'lessons',
  candles: 'orders', coffee: 'orders', bakery: 'orders', food: 'orders', plants: 'orders', apparel: 'orders', jewelry: 'orders', art: 'orders', resale: 'orders',
  events: 'events',
};

const STEPS = {
  onsite: [
    ['You pick a day and a time window', 'We confirm it in writing, with the price.'],
    ['We remind you the day before', 'A short text with the time window and anything to get ready.'],
    ['We look at the job with you first', 'We agree on what gets done before we start, so there are no surprises.'],
    ['We do the work', "You don't need to stay with us. If a question comes up, we'll find you."],
    ['We check it together before we leave', 'If something was missed, we fix it on the spot.'],
    ['You pay, and we set the next visit if you want one', 'Regular visits keep the same day and time.'],
  ],
  visit: [
    ['You book a time', 'We confirm it in writing, with the price.'],
    ['We remind you the day before', 'A short text with the time and anything to bring.'],
    ['You arrive a few minutes early', 'So we can start on time and you get the full appointment.'],
    ['We agree on the plan first', 'Bring photos or ideas. We talk it through before we start.'],
    ['We do the work', 'Ask questions any time. It is your appointment.'],
    ['You pay and book the next one if you want', 'Booking before you leave keeps your usual time.'],
  ],
  online: [
    ['We start with a short kickoff call', 'Your goals, examples you like, and what you need first.'],
    ['You send what we need in one place', 'Logins, logo, photos and text in one folder or one email.'],
    ['We send a first version', 'With a date for your feedback, so the work keeps moving.'],
    ['You send your changes in one message', 'One list of notes, so nothing gets lost.'],
    ['We deliver the final files', 'Everything in one place, with how to use it.'],
    ['We check in a couple of weeks later', 'To see how it is working and answer questions.'],
  ],
  lessons: [
    ['We start with a first session', 'We find out where things stand and what feels hardest.'],
    ['We set a simple plan', 'What we work on, and when we meet.'],
    ['We meet at the same time each week', 'A steady time makes it easy to keep going.'],
    ['You get a short note after each session', 'What we covered and what to practice.'],
    ['We look at progress together every few weeks', 'And change the plan if something is not working.'],
  ],
  orders: [
    ['You tell us what you want', 'The date you need it, how many, and any colors, scents, flavors or ideas.'],
    ['We confirm the details and the price in writing', 'Nothing gets made until you say yes.'],
    ['We make your order', 'We message you if a question comes up.'],
    ['We tell you when it is ready', 'Pickup or delivery at the time we agreed.'],
    ['We check in after', 'If something is not right, tell us and we will make it right.'],
  ],
  events: [
    ['We talk through your event', 'The date, the place, the head count and the feel you want.'],
    ['You get a written plan and price', 'Nothing is booked until you say yes.'],
    ['We confirm the details the week before', 'The timeline, who to call on the day, and any changes.'],
    ['On the day, we handle our part', 'You have one person to call for anything we do.'],
    ['We follow up after', 'To hear how it went and send anything we promised.'],
  ],
};

// How customers get ready, by kind of business (advice to the customer, not claims about the business).
const PREP = {
  detailing: ['Take out anything you want kept safe: chargers, sunglasses, car seats.', 'Park where we can reach all four sides of the car.', 'Tell us about stains, pet hair or smells you want us to focus on.'],
  washing: ['Close windows and doors on the sides we are washing.', 'Move planters, furniture and toys away from the walls and the driveway.', 'Tell us where the outdoor water tap is.'],
  cleaning: ['Pick up clothes, toys and papers so we can clean surfaces, not tidy.', 'Tell us about rooms to skip and anything fragile.', 'Let us know how we get in and about any pets at home.'],
  lawn: ['Pick up toys, hoses and dog waste from the lawn.', 'Unlock the gate or send us the code.', 'Tell us where sprinkler heads or low wires are.'],
  pets: ['Leave the leash, treats and any medicine in one spot.', "Write down feeding times, habits and your vet's number.", 'Tell us how we get in and where your pet will be.'],
  home_services: ['Clear a path to where we will work, and move things off the area.', 'Tell us about pets, parking and how we get in.', 'Write down your questions so we can cover them on the first visit.'],
  beauty: ['Tell us about allergies or sensitive skin before the appointment.', 'Bring a photo of the look you want.', 'Give yourself a few extra minutes for parking.'],
  photo: ['Pick two or three outfits in solid colors and bring them on hangers.', 'Send us a few photos you like the look of.', 'Plan to arrive 10 minutes early to settle in.'],
  fitness: ['Wear clothes you can move in and bring water.', 'Tell us about injuries or health limits before the first session.', 'Eat something light an hour or two before.'],
  web: ['Gather your logins, logo, photos and text in one folder.', 'Send two or three sites you like and say why.', 'Tell us who signs off on the work and how fast you can reply.'],
  video: ['Put your raw footage in one shared folder.', 'Send two or three videos you like the look of.', 'Tell us where the video will be posted and how long it should be.'],
  social: ['Gather your logins and brand colors in one place.', 'Send three accounts you like and say why.', 'Tell us what you never want posted.'],
  tech: ['List the apps you use now and what each one is for.', 'Write down the task that eats the most of your week.', 'Have admin access ready for the tools we will connect.'],
  content: ['Send two or three pieces you like and say why.', 'Gather your logo, colors and any past work in one folder.', 'Tell us how fast you can review a draft.'],
  coaching: ['Write down the one thing you most want to change.', 'Find a quiet spot with good internet for our calls.', 'Keep 15 minutes free after each call to write your next steps.'],
  templates: ['Check which apps you will open the files in.', 'Keep your download email in a safe place.', 'Tell us if anything looks off on your screen.'],
  tutoring: ['Have the latest homework, tests or report card ready.', 'Write down what feels hardest right now.', 'Set up a quiet spot with paper, pencils and a charged device.'],
  kids: ['Send allergies, medicine and emergency contacts in writing.', 'Pack a change of clothes, a water bottle and a labeled snack.', 'Tell us who is allowed to pick up your child.'],
  candles: ['Tell us the date you need it and how many.', 'Send the scents, colors or labels you have in mind.', 'Tell us where it should go: pickup, delivery or shipping.'],
  coffee: ['Tell us the date, the time and how many people.', 'Tell us about dairy-free or decaf needs.', 'Send the address and where we should set up.'],
  bakery: ['Tell us the date, how many people and pickup or delivery.', 'Send allergies and dietary needs in writing.', 'Share a photo or idea of what you want.'],
  food: ['Tell us the date, the head count and the serving time.', 'Send allergies and dietary needs in writing.', 'Tell us about the kitchen or space we will use.'],
  plants: ['Send the date, the delivery address and the best time.', 'Share the colors, a photo you like or the occasion.', 'Tell us about any flower allergies.'],
  apparel: ['Send your sizes or a size chart for the group.', 'Share the design, colors and any logo files.', 'Tell us the date you need it in hand.'],
  jewelry: ['Send your ring or wrist size if you know it.', 'Share a photo or idea of what you want.', 'Tell us the date you need it in hand.'],
  art: ['Send the size and the wall or space it is for.', 'Share colors, photos or ideas you like.', 'Tell us the date you need it.'],
  resale: ['Send photos of what you are looking for.', 'Tell us your size and budget.', 'Tell us how you want to pick up or get it shipped.'],
  events: ['Send the date, the place and a rough head count.', 'Tell us the timeline of the day and who our contact is on site.', 'Share the theme or colors, with a photo or two.'],
  generic: ['Tell us anything we should know before we start.', 'Write down your questions so we can cover them first.', 'Save our number so our messages reach you.'],
};

// Lines a member types ("Title: detail" or a plain sentence) -> [{ title, detail }].
function linesToSteps(raw, max = 8) {
  return String(raw || '').replace(/\r/g, '').split(/\n+/).map((l) => text.oneLine(l.replace(/^\s*(?:[-*\u2022]|\d+[.)])\s*/, ''))).filter((l) => l.length > 2)
    .slice(0, max)
    .map((l) => {
      const m = l.match(/^([^:]{3,60}):\s*(.+)$/);
      const title = text.sentenceCase((m ? m[1] : l).replace(/[.]+$/, ''));
      const detail = m ? `${text.sentenceCase(m[2]).replace(/[.]+$/, '')}.` : '';
      return { title: text.clip(title, 90), detail: text.clip(detail, 200) };
    });
}

function linesOf(raw, max = 8) {
  return String(raw || '').replace(/\r/g, '').split(/\n+/).map((l) => text.oneLine(l.replace(/^\s*(?:[-*\u2022]|\d+[.)])\s*/, ''))).filter((l) => l.length > 2)
    .slice(0, max)
    .map((l) => `${text.sentenceCase(l).replace(/[.]+$/, '')}.`);
}

function draft(nicheId, { steps, prepare } = {}) {
  const group = GROUP[nicheId] || 'onsite';
  const own = linesToSteps(steps);
  const list = own.length >= 2 ? own : STEPS[group].map(([title, detail]) => ({ title, detail }));
  const prep = linesOf(prepare, 6);
  return {
    group,
    steps: list.map((s, i) => ({ id: `s${i + 1}`, n: i + 1, ...s })),
    prep: prep.length ? prep : PREP[nicheId] || PREP.generic,
    stepsFrom: own.length >= 2 ? 'yours' : 'suggested',
    prepFrom: prep.length ? 'yours' : 'suggested',
  };
}

// The opening line, which depends on how the business works.
// No service yet (nothing says what they sell): the lines leave it out instead of a blank.
function thanks(group, service, business) {
  if (group === 'orders') return `Thanks for ordering from ${business}.`;
  if (group === 'online' || group === 'lessons' || group === 'events') return service ? `Thanks for choosing ${business} for ${service}.` : `Thanks for choosing ${business}.`;
  return service ? `Thanks for booking ${service} with ${business}.` : `Thanks for booking with ${business}.`;
}

// The four messages a new customer gets. f: { business, firstName, customer, service, when, steps, prep, policies, phone, email, group }
function messages(f) {
  const hi = `Hi ${f.customer || 'there'},`;
  // No business name yet (an empty brain): "us" stands in, and nothing reads "Your business".
  const biz = f.business || 'us';
  const me = f.firstName ? (f.business ? `${f.firstName} from ${f.business}` : f.firstName) : f.business;
  // Replying to the email reaches the member, so the email only adds the phone.
  const reachLine = f.phone ? `Questions before then? Just reply to this email, or call or text ${f.phone}.` : 'Questions before then? Just reply to this email.';
  const bare = String(f.service || '').replace(/^(a|an|the|your|my|our)\s+/i, '');
  const when = f.when ? ` ${f.when}` : '';
  const sign = [f.firstName, f.business].filter(Boolean).join('\n') || 'Thank you';
  const subject = f.business ? `Welcome to ${f.business}: what happens next` : 'Welcome: what happens next';
  const email = `${hi}

${thanks(f.group, f.service, biz)}${f.when ? ` We are all set for${when}.` : ''} Here is how it works:

${f.steps.map((s, i) => `${i + 1}. ${s.title}${s.detail ? `. ${s.detail}` : '.'}`).join('\n')}

To get ready:
${f.prep.map((p) => `- ${p}`).join('\n')}
${f.policies && f.policies.length ? `\nGood to know:\n${f.policies.map((p) => `- ${p}`).join('\n')}\n` : ''}
The welcome guide attached has all of this on one page.

${reachLine}

${sign}`;
  const youGo = f.group === 'visit';
  const at = f.when ? `,${when}` : '';
  const bookedWhat = {
    orders: 'Your order is confirmed.',
    online: f.service ? `You're all set for ${f.service}${at}.` : `You're all set${at}.`,
    lessons: `Your first ${bare ? `${bare} ` : ''}session is booked${at}.`,
  }[f.group] || (f.service ? `You're booked for ${f.service}${at}.` : `You're booked${at}.`);
  const booked = `${hi.replace(/,$/, '')}${me ? `, it's ${me}` : ''}. ${bookedWhat} I just emailed a short welcome guide with what to expect and how to get ready. Reply here with any questions.`;
  const remindWhat = {
    orders: `your order from ${biz} is due`,
    online: f.service ? `our kickoff call for ${f.service} is` : 'our kickoff call is',
    lessons: `your first ${bare ? `${bare} ` : ''}session is`,
  }[f.group] || `your ${bare || (f.group === 'events' ? 'event' : f.group === 'visit' ? 'appointment' : 'visit')} with ${biz} is`;
  const reminder = `${hi.replace(/,$/, '')}, a reminder that ${remindWhat} ${f.when ? f.when.replace(/^on /i, '') : 'tomorrow'}. ${f.prep[0] || ''} ${youGo ? 'See you then.' : 'Reply here if anything changed.'}`.replace(/\s+/g, ' ').trim();
  const after = `Thank you for choosing ${biz}${f.customer ? `, ${f.customer}` : ''}. If anything isn't right, reply here and we'll make it right. If you were happy, a short Google review helps a small business like ours. Either way, thank you.`;
  return { subject, email, booked, reminder, after };
}

function messagesTxt(m) {
  return `WELCOME EMAIL (send when they book, with the welcome guide attached)
Subject: ${m.subject}

${m.email}


BOOKING TEXT (right after they book)
${m.booked}


REMINDER TEXT (the day before)
${m.reminder}


AFTER THE VISIT
${m.after}
`;
}

// The printable welcome guide (one Letter page for most kits, no scripts).
function guideHtml({ spec, group, service, steps, prep, policies, contact }) {
  const c = spec.colors;
  const d = L.draw('wordmark', spec, 'color');
  const logo = L.logoSvg(d, { pad: 0.02 });
  const rows = [
    contact.phone ? ['Call or text', contact.phone] : null,
    contact.email ? ['Email', contact.email] : null,
    contact.website ? ['Website', contact.website.replace(/^https?:\/\//, '').replace(/\/$/, '')] : null,
    contact.hours ? ['Hours', contact.hours] : null,
  ].filter(Boolean);
  const css = `@page{size:letter;margin:.45in}*{box-sizing:border-box}
body{margin:0;background:${c.paper};color:${c.ink};font:15px/1.5 Inter,"Helvetica Neue",Arial,sans-serif}
main{max-width:820px;margin:0 auto;padding:40px 36px 48px}
header{display:flex;justify-content:space-between;align-items:center;gap:20px;border-bottom:3px solid ${c.primary};padding-bottom:18px}
header .logo svg{height:64px;width:auto;max-width:360px;display:block}
.kicker{font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:${c.muted};font-weight:700;text-align:right}
h1{font-size:38px;line-height:1.08;margin:26px 0 6px;letter-spacing:-.02em}
.lede{color:${c.muted};font-size:17px;margin:0 0 8px}
h2{font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:${c.primary};margin:28px 0 12px}
ol.steps{list-style:none;margin:0;padding:0;counter-reset:s}
ol.steps li{counter-increment:s;position:relative;padding:0 0 14px 52px;break-inside:avoid}
ol.steps li:before{content:counter(s);position:absolute;left:0;top:0;width:34px;height:34px;border-radius:50%;background:${c.primary};color:${c.onPrimary};font-weight:800;display:flex;align-items:center;justify-content:center}
ol.steps b{display:block;font-size:16px;padding-top:5px}ol.steps span{color:${c.muted}}
ul.check{list-style:none;margin:0;padding:0}ul.check li{position:relative;padding:4px 0 8px 34px}
ul.check li:before{content:"";position:absolute;left:0;top:6px;width:18px;height:18px;border:2px solid ${c.primary};border-radius:5px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:26px}
.card{background:${c.surface};border-radius:16px;padding:16px 20px}
.reach div{margin:0 0 10px}.reach div:last-child{margin:0}.reach small{display:block;color:${c.muted};font-size:12px}.reach b{font-size:16px;overflow-wrap:anywhere}
footer{margin-top:30px;color:${c.muted};font-size:12px;border-top:1px solid ${c.line};padding-top:12px}
@media (max-width:640px){main{padding:24px 18px 36px}h1{font-size:32px}.two{grid-template-columns:1fr;gap:0}header{flex-direction:column;align-items:flex-start}.kicker{text-align:left}}
@media print{main{padding:0}}`;
  const body = `<main>
<header><div class="logo">${spec.name ? logo.replace(/<\?xml[^>]*>/, '') : ''}</div><div class="kicker">Welcome guide</div></header>
<h1>Welcome${spec.name ? ` to ${esc(spec.name)}` : ''}</h1>
<p class="lede">${esc(thanks(group, service, spec.name || 'us'))} Here is how it works, how to get ready and how to reach us.</p>
<h2>How it works</h2>
<ol class="steps">${steps.map((s) => `<li><b>${esc(s.title)}</b>${s.detail ? `<span>${esc(s.detail)}</span>` : ''}</li>`).join('')}</ol>
<div class="two">
<div><h2>Before we start</h2><ul class="check">${prep.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>
<div><h2>Questions?</h2><div class="card reach">${rows.length ? rows.map(([k, v]) => `<div><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join('') : 'Reply to the message this guide came with, and we will get back to you.'}</div></div>
</div>
${policies.length ? `<h2>Good to know</h2><ul>${policies.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
<footer>${spec.name ? `${esc(spec.name)}${spec.city ? `, ${esc(spec.city)}` : ''}. ` : ''}Thank you for choosing us.</footer>
</main>`;
  return files.htmlDoc({ title: spec.name ? `Welcome to ${spec.name}` : 'Welcome guide', css, body, description: `How ${service || 'it'}${spec.name ? ` with ${spec.name}` : ''} works, how to get ready and how to reach us` });
}

module.exports = { GROUP, STEPS, PREP, draft, linesToSteps, linesOf, thanks, messages, messagesTxt, guideHtml };
