// The onboarding kit a new coaching client reads: welcome, intake questions, a one-page agreement
// (what coaching is and isn't, sessions, price, moving sessions, privacy, refund), the first session
// plan, the recap template and an optional story consent form with its disclosure line.
// Printable HTML (no scripts) plus the pieces to paste. No results or earnings claims. In the
// onboarding workflow the price comes from the win step, so the kit says the same founding price.

const { views, files, save, money, text } = require('../../_kit');
const C = require('../../_kit/common');

const { plain } = text;
const { usd } = money;
const esc = files.esc;
const BLANK = '<span style="display:inline-block;width:200px;border-bottom:1px solid #9aa3b2"></span>';
const SHORT = '<span style="display:inline-block;width:90px;border-bottom:1px solid #9aa3b2"></span>';
const BOX = '<span style="display:inline-block;width:14px;height:14px;border:2px solid #5b6475;border-radius:3px;vertical-align:-3px;margin-right:6px"></span>';

const INTAKE = [
  'In your own words, what is the one result you want from coaching?',
  'Where are you with it today? Give an example or two.',
  'What have you already tried, and what happened?',
  'What would be different in 3 months if this went well?',
  'What might get in the way?',
  'Which days and times work for our sessions?',
];

function kitTool(N) {
  return {
    name: 'coaching.build_onboarding_kit',
    title: 'Client onboarding kit',
    description: 'Everything a new client reads before session 1: welcome message, intake questions, a one-page agreement, the first session plan, the recap template and an optional story consent form with a disclosure line.',
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 1,
    timeoutSec: 30,
    input: {
      type: 'object',
      required: ['client'],
      properties: {
        client: { type: 'string', maxLength: 60, title: "Client's name" },
        result: { type: 'string', maxLength: 120, title: 'The result they want (optional)' },
        price: { type: 'string', maxLength: 10, title: 'Your price per session (optional)' },
        price_note: { type: 'string', maxLength: 40, title: 'Which price this is (optional)', description: 'Like "founding price"' },
        sessions: { type: 'string', maxLength: 3, title: 'Sessions agreed', default: '4' },
        free: { type: 'boolean', title: 'Sessions are free (founding client)', default: false },
        business: { type: 'string', maxLength: 80, title: 'Business name (optional)' },
        link: { type: 'string', maxLength: 300, title: 'Booking or payment link (optional)' },
      },
    },
    output: { type: 'object', required: ['kit', 'welcome'], properties: { kit: { type: 'object' }, welcome: { type: 'string' } } },
    async run(input, ctx) {
      const me = C.who(ctx, input);
      const offer = C.offerOf(N, { price: input.price || C.priceOf(ctx, N, {}) });
      const note = plain(input.price_note || '').toLowerCase();
      const founding = /founding/.test(note);
      const client = plain(input.client || 'there');
      const first = client.split(' ')[0];
      const result = plain(input.result || '').replace(/[.]$/, '');
      const count = Math.max(1, Math.min(52, parseInt(input.sessions, 10) || 4));
      const free = input.free === true || input.free === 'true';
      const priceLine = free ? `${count} sessions, free, as a founding client. Honest feedback at the end is all I ask.` : `${count} sessions at ${usd(offer.price)} per session${note && note !== 'full price' ? ` (my ${note})` : ''}.`;
      const coach = me.first || me.business || 'Your coach';
      const welcome = [
        `Hi ${first}, welcome! I'm glad we're working together${result ? ` on this: ${result}` : ''}.`,
        `Before our first session, please answer the 6 questions in the kit. Short answers are fine.`,
        `We'll meet for ${offer.length} each time, and you'll get a recap from me within 24 hours.`,
        `${me.link ? `Book or move sessions here: ${me.link}` : 'Reply here to book or move a session.'}`,
        coach,
      ].join('\n');
      const agreement = [
        'Coaching is a partnership: you set the goal and do the work between sessions; I bring structure, questions and follow-up.',
        "Coaching isn't therapy, medical, legal or financial advice. If something needs one of those, I'll say so and help you find the right person.",
        priceLine,
        "Move or cancel with 24 hours' notice. If I miss a session or I'm late, the next one is free. If the first paid session isn't a fit, I refund it.",
        'What you share stays private, except where the law requires otherwise or someone is at risk of harm.',
        "I don't promise results. Either of us can end the coaching with a week's notice; unused prepaid sessions are refunded.",
      ];
      const session1 = ['Your one result, in your words, and how we will both know it moved.', 'Where you are today, using your own examples.', 'The first obstacle to work on.', '1 to 3 actions you choose, with dates.', 'When and how we check in between sessions.'];
      const recap = `Hi ${first}, here's today's recap.\nWhat we covered: \nActions you chose (with dates): \n1. \n2. \nCheck-in: I'll message you on \nNext session: \n${coach}`;
      const D = N.story.disclosure;
      const disclosure = free ? C.fill(D.free, { who: first }) : founding ? C.fill(D.founding, { who: first }) : '';
      const li = C.li;
      const body = `<main>
<p class="muted">${esc(me.business || 'Coaching')}</p>
<h1>Welcome, ${esc(first)}</h1>
<p>${esc(welcome).replace(/\n/g, '<br>')}</p>
<h2>Before our first session</h2>${li(INTAKE)}
<h2>Our agreement</h2>${li(agreement)}
<p>Client: ${BLANK} Date: ${SHORT}</p><p>Coach: ${BLANK} Date: ${SHORT}</p>
<h2>Session 1 plan</h2>${li(session1)}
<h2>After every session</h2><p>You get a short recap: what we covered, the actions you chose and when I'll check in.</p>
<h2>Your story (optional)</h2>
<div class="box"><p>Sharing your story is completely up to you. Saying no changes nothing about our work${free ? ', and your sessions are free either way' : ''}. If you say yes, I will send you the exact words to approve first and leave out any money or health results${disclosure ? `, and this line goes wherever the story appears: "${esc(disclosure.replace(/[.]$/, ''))}"` : ''}.</p>
<p>${BOX}Yes, you may share the story I approve in writing. &nbsp; ${BOX}No, thank you.</p><p>Name: ${BLANK} Date: ${SHORT}</p></div>
<footer>Coaching, not therapy. No results are promised; the work is yours and the structure is mine.</footer>
</main>`;
      const html = files.htmlDoc({ title: `Welcome kit for ${first}`, css: C.SHEET_CSS, body, description: 'Coaching welcome kit' });
      const kit = await save.saveFile(ctx, save.fileName(first, 'coaching welcome kit', '.html'), html);
      return { kit, welcome, intake: INTAKE, agreement, session1, recap, disclosure, free };
    },
    view(out) {
      return views.blocks(
        views.copy('Welcome message', out.welcome),
        views.copy('Intake questions', out.intake.map((q, i) => `${i + 1}. ${q}`).join('\n')),
        views.text(`Agreement: ${out.agreement.join(' ')}`),
        views.copy('Recap template (send within 24 hours)', out.recap),
        views.text(`Story consent is optional and asked in writing.${out.disclosure ? ` Disclosure line for any story: ${out.disclosure}` : ''}`),
        views.file(out.kit, 'Welcome kit (print or send)'),
      );
    },
  };
}

module.exports = { kitTool };
