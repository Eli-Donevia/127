// Do the job right: the setup sheet for a signed client. Picks the tools from what the client
// already uses, with current prices from each vendor's page (data/tools.json), the carrier's
// forwarding codes, texting registration, the recording notice where it's needed, the texts and
// answers to paste, a test plan, a Notion-ready checklist and the messages to the client.
// Nothing is bought for them: every account is in the client's name.

const kit = require('../../_kit');
const { text, views, save, brain, time } = kit;
const NICHE = require('../data/niche.json');
const TOOLS = require('../data/tools.json');
const { readSite, emptyFacts } = require('../lib/site');
const plan = require('../lib/plan');
const { setupHtml } = require('../lib/pages');

const CARRIERS = Object.keys(NICHE.forwarding);

module.exports = {
  name: 'frontdesk.setup_sheet',
  title: 'Setup sheet',
  description: 'Makes the setup sheet for a signed client: the tools to use with current prices, call forwarding codes for their carrier, texting registration, the texts and answers to paste, the test plan and a checklist.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 4,
  input: {
    type: 'object',
    required: ['client'],
    properties: {
      client: { type: 'string', maxLength: 100 },
      website: { type: 'string', maxLength: 300 },
      phone: { type: 'string', maxLength: 40 },
      carrier: { type: 'string', enum: CARRIERS },
      software: { type: 'string', enum: ['jobber', 'housecallpro', 'none'] },
      afterHours: { type: 'string', enum: ['textback', 'ai', 'people'] },
      state: { type: 'string', maxLength: 2 },
      records: { type: 'boolean' },
      hours: { type: 'string', maxLength: 160 },
      area: { type: 'string', maxLength: 240 },
      services: { type: 'string', maxLength: 400 },
      bookingLink: { type: 'string', maxLength: 300 },
      emergency: { type: 'string', maxLength: 200 },
      alerts: { type: 'string', maxLength: 120 },
      trade: { type: 'string', enum: Object.keys(NICHE.trades) },
      myName: { type: 'string', maxLength: 60 },
      myContact: { type: 'string', maxLength: 160 },
    },
  },
  output: { type: 'object', required: ['sheet', 'stack'], properties: { sheet: { type: 'object' }, checklist: { type: 'object' }, stack: { type: 'array' } } },
  timeoutSec: 90,
  async run(input, ctx) {
    const br = brain.brainOf(ctx, {});
    const trade = input.trade || 'contractors';
    const client = { name: text.plain(input.client), phone: text.plain(input.phone || '') };
    let facts = emptyFacts();
    let site = null;
    if (input.website) {
      site = await readSite(ctx, { website: input.website, trade });
      if (site.reachable) facts = site.facts;
    }
    facts.name = client.name;
    if (input.hours) facts.hours = { text: text.plain(input.hours) };
    if (input.area) facts.area = { places: input.area.split(/,|\band\b/).map((s) => text.plain(s.trim())).filter(Boolean), quote: text.plain(input.area) };
    if (input.services) facts.services = input.services.split(/[,\n]+/).map((s) => ({ text: text.plain(s.trim()) })).filter((s) => s.text);
    if (input.bookingLink) facts.booking = { tools: ['their booking page'], link: input.bookingLink.trim() };
    if (input.emergency) facts.emergency = { text: text.plain(input.emergency) };
    const software = ['jobber', 'housecallpro'].includes(input.software) ? input.software : 'none';
    const after = ['ai', 'people'].includes(input.afterHours) ? input.afterHours : 'textback';
    const st = TOOLS.stacks[software];
    const ids = [...st.tools];
    if (after !== 'textback' && !(software === 'jobber' && after === 'ai') && !(software === 'housecallpro' && after === 'ai')) ids.push(TOOLS.after_hours[after].tools[0]);
    const stack = ids.map((id) => ({ id, ...TOOLS.tools[id] }));
    if (!facts.booking) stack.push({ id: 'booking', name: st.booking, role: 'Booking page', price: software === 'none' ? `Calendly: ${TOOLS.tools.calendly.price}. ${TOOLS.tools.gcal.name}: ${TOOLS.tools.gcal.price}.` : 'Included in their plan', url: software === 'none' ? TOOLS.tools.calendly.url : TOOLS.tools[ids[0]].url, monthly: 0 });
    else stack.push({ id: 'booking', name: 'Their booking link', role: 'Booking page', price: 'Already set up', url: facts.booking.link, monthly: 0 });
    if (software === 'none') stack.push({ id: 'tendlc', name: 'Texting registration (A2P 10DLC)', role: 'Lets the business number send texts', price: TOOLS.ten_dlc.fees, url: TOOLS.ten_dlc.urls[0], monthly: 0 });
    const monthly = stack.map((s) => s.monthly).filter((n) => typeof n === 'number');
    const known = monthly.reduce((a, b) => a + b, 0);
    const costs = stack.some((s) => s.monthly == null)
      ? `Monthly tool cost: ${known ? `about $${known} a month plus ` : ''}the price Housecall Pro quotes for CSR AI. Ask them before go-live.`
      : `Monthly tool cost for ${client.name}: about $${known} a month at the lowest listed plans, plus one-time texting registration where it applies. Paid by ${client.name}, on their own card.`;
    const carrier = NICHE.forwarding[CARRIERS.includes(input.carrier) ? input.carrier : 'other'];
    const answerNumber = software === 'none' ? 'the Quo number' : after === 'ai' ? 'the answering number the tool gives you' : 'the answering number';
    const state = String(input.state || '').toUpperCase();
    const allParty = NICHE.recording.all_party_states.includes(state);
    const recording = input.records
      ? allParty
        ? `${state} needs every party's consent to record. The greeting must start with: "This call may be recorded." (${NICHE.recording.source})`
        : `Add "This call may be recorded" to the greeting anyway: callers can be in states that need everyone's consent. (${NICHE.recording.source})`
      : '';
    const steps = [
      `Get ${client.name}'s facts in writing: hours, services, service area, emergency policy, booking link and who gets alerts${input.alerts ? ` (${text.plain(input.alerts)})` : ''}.`,
      software === 'jobber'
        ? 'In Jobber, add the AI Receptionist add-on on their account and load the answers below.'
        : software === 'housecallpro'
          ? 'Ask Housecall Pro to switch on CSR AI on their account (no public price) and load the answers below.'
          : `Create the Quo account in ${client.name}'s name, add their business number or port it, and turn on the missed-call auto-reply.`,
      software === 'none' ? `Register texting (A2P 10DLC) under ${client.name}'s business inside Quo before going live. ${TOOLS.ten_dlc.timing}` : 'Check texting registration is done inside their software before going live.',
      'Paste the missed-call text and the after-hours text below. Read them out loud with the owner.',
      `Set call forwarding on ${client.phone || 'their cell'} so only missed calls go to ${answerNumber}: ${carrier.on}.`,
      after === 'ai' ? (software === 'none' ? `Set up ${TOOLS.tools[TOOLS.after_hours.ai.tools[0]].name} for after-hours calls using its own setup guide (it gives you the number to send calls to), then load the answers below. Make it take a message and text the owner for anything it can't answer.` : 'Load the answers below into the AI receptionist. Make it take a message and text the owner for anything it can\'t answer.') : after === 'people' ? 'Send the answering service the answers below and the owner\'s emergency policy.' : 'Text back only: no call answering after hours. The after-hours text tells callers when they\'ll hear back.',
      recording ? 'Add the recording notice to the greeting.' : 'No call recording: leave recording off.',
      'Run every test below with the owner watching.',
      `Go live. Give ${client.name} this sheet with every login, setting and monthly cost.`,
    ];
    const tests = [
      'Call during business hours from a phone that isn\'t theirs. Let it ring out. The missed-call text arrives within a minute.',
      'Call after hours. The after-hours text arrives, and the AI or service answers if that\'s part of the setup.',
      'Reply STOP. The confirmation arrives and no more texts are sent to that phone.',
      'Book a test job from the text. It shows up on their calendar.',
      'Check the owner got an alert for each test.',
      `Turn forwarding off and on once (${carrier.off}) so the owner knows how.`,
    ];
    const texts = plan.texts(facts, { trade });
    const faq = plan.faq(facts, { trade, city: br.city });
    const today = time.today(ctx);
    const member = { name: text.plain(input.myName || br.firstName || ''), contact: text.plain(input.myContact || '') };
    const html = setupHtml({ client, stack, steps, texts, faq, tests, costs, member, checked: today, recording, forwarding: carrier });
    const sheet = await save.saveFile(ctx, save.fileName(client.name, 'setup-sheet', '.html'), html);
    const md = [
      `# ${client.name}: front desk setup`,
      '',
      `Prepared ${today}. Prices checked ${TOOLS.checked} on each vendor's page.`,
      '',
      '## Tools',
      ...stack.map((s) => `- ${s.name} (${s.role}): ${s.price} ${s.url ? `[${s.url}](${s.url})` : ''}`),
      '',
      '## Steps',
      ...steps.map((s) => `- [ ] ${s}`),
      '',
      '## Tests',
      ...tests.map((s) => `- [ ] ${s}`),
      '',
      '## Every week',
      '- [ ] Read the texts and fix wrong answers',
      '- [ ] Check the booking link',
      '',
      '## Every month',
      '- [ ] Send the one-page report',
    ].join('\n');
    const checklist = await save.saveFile(ctx, save.fileName(client.name, 'setup-checklist', '.md'), md);
    const welcome = text.plain(
      `Hi ${client.name} team, thanks for saying yes! To get you live this week I need: 1) your business hours and service area, 2) your emergency policy, 3) your booking link if you have one, 4) who should get the alerts, and 5) a user invite to ${software === 'jobber' ? 'your Jobber account' : software === 'housecallpro' ? 'your Housecall Pro account' : "the new phone account, which we'll set up in your name together"}. Every account stays in your name.`,
    );
    const live = text.plain(`You're live! From now on, every call you miss gets a text back from your number with a way to book. To switch forwarding off, dial ${carrier.off}. I'll check the texts every week and send you a one-page report at the end of the month.`);
    return { client: client.name, software, afterHours: after, stack, costs, steps, tests, texts, faq, recording, carrier: carrier.label, sheet, checklist, welcome, live, checked: TOOLS.checked, siteRead: !!(site && site.reachable), sample: !!(site && site.sample) };
  },
  view(out) {
    return views.blocks(
      views.metric(`Setup for ${out.client}`, out.stack.length, out.costs),
      views.table([{ key: 'role', label: 'Piece' }, { key: 'name', label: 'Tool' }, { key: 'price', label: 'Price (their account)' }, { key: 'url', label: 'Checked on', format: 'link' }], out.stack),
      views.cards(out.steps.map((s, i) => ({ title: `Step ${i + 1}`, body: s }))),
      views.copy('Message to send when they say yes', out.welcome),
      views.copy('Message for go-live day', out.live),
      views.copy('The missed-call text', out.texts[0].text),
      views.file(out.sheet, 'Setup sheet (printable)'),
      views.file(out.checklist, 'Checklist for Notion (.md)'),
    );
  },
};
