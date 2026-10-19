// The front desk half of call prep: what to check before the call (ring their number and let it go
// to voicemail), their facts, the questions to ask, the price said once (founding terms while the
// member has fewer than 3 clients), the trade's worries with answers, the close and what to do after.
// It also hands sales.call_script the notes and the member's options, and puts the call on their
// calendar. Moves the business to "Call booked" in the Pipeline.

const kit = require('../../_kit');
const { text, views, files, save, brain, time } = kit;
const NICHE = require('../data/niche.json');
const talk = require('../../_kit/talk');
const close = require('../lib/close');
const prices = require('../lib/prices');
const { shortName } = require('../lib/plan');

// "2pm", "2:30 pm", "14:00" -> "14:00"; '' when it can't tell.
function clock(s) {
  const m = String(s || '').trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/);
  if (!m) return '';
  let h = Number(m[1]);
  const min = Number(m[2] || 0);
  if (h > 23 || min > 59) return '';
  if (m[3] && m[3].startsWith('p') && h < 12) h += 12;
  if (m[3] && m[3].startsWith('a') && h === 12) h = 0;
  if (!m[3] && h >= 1 && h <= 6) h += 12; // "3" is 3pm on a work call
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

const nice = (date, hhmm) => {
  const [y, mo, d] = date.split('-').map(Number);
  const day = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(Date.UTC(y, mo - 1, d, 12)));
  if (!hhmm) return day;
  const [h, m] = hhmm.split(':').map(Number);
  return `${day} at ${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''}${h < 12 ? 'am' : 'pm'}`;
};

module.exports = {
  name: 'frontdesk.call_card',
  title: 'Front desk call card',
  description: 'One card for a sales call with a contractor: what to check first, their facts, the questions to ask, your price said once, answers to the six usual worries, the close and what to do after. Puts the call on your calendar.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 2,
  input: {
    type: 'object',
    required: ['lead'],
    properties: {
      lead: { type: 'object' },
      prospect: { type: 'object' },
      notes: { type: 'string', maxLength: 3000 },
      owner: { type: 'string', maxLength: 80 },
      callDate: { type: 'string', maxLength: 10 },
      callTime: { type: 'string', maxLength: 20 },
      myName: { type: 'string', maxLength: 60 },
    },
  },
  output: { type: 'object', required: ['name', 'questions', 'worries', 'notes', 'optionsText'], properties: { name: { type: 'string' }, questions: { type: 'array' }, worries: { type: 'array' }, notes: { type: 'string' }, optionsText: { type: 'string' }, price: { type: 'number' } } },
  timeoutSec: 30,
  async run(input, ctx) {
    const lead = input.lead || {};
    const prospect = input.prospect && typeof input.prospect === 'object' ? input.prospect : {};
    const name = text.plain(lead.name || prospect.name || 'This business');
    const s = shortName(name);
    const br = brain.brainOf(ctx, {});
    const me = text.plain(input.myName || br.firstName || '');
    const notes = text.plain(input.notes || '');
    const rows = await talk.pipelineRows(ctx);
    const clients = talk.wonCount(rows, 'frontdesk');
    const founding = clients < NICHE.first_clients.founding_count;
    const n = prices.offerNumbers({}, ctx);
    const P = prices.priceSay(n, { founding });
    const owner = text.oneLine(String(input.owner || '')).split(' ')[0] || '';

    const checked = prospect.readOn || '';
    const checkFirst = close.checkFirst({ lead, prospect, checked });
    if (lead.data && lead.data.planMade) checkFirst.splice(1, 0, { item: `Open the missed-call plan you made for ${s} (${lead.data.planMade})`, why: 'Walk through it on the call: the text their number would send is the easiest thing to say yes to.' });
    const worries = close.worriesFor(`${notes}\n${lead.reply || ''}`);
    const price = {
      say: P.base,
      founding: P.founding,
      tools: P.tools,
      from: n.saved ? 'your saved offer' : 'the middle of the usual range (run "Your offer" to set yours)',
    };
    const closeLine = founding
      ? `Here's what I'd suggest: I set up the text back and the booking link on your number this week. ${P.founding} Want me to send the agreement today?`
      : `Here's what I'd suggest: I set up the text back and the booking link on your number this week and look after it every month. ${P.base} Want me to send the agreement today?`;
    const after = [
      { if: 'They say yes', then: `Send the proposal and the quote the same day (run "Proposal"), then "Set up a new client" once it's signed. Ask for user access to their phone account and booking tool.` },
      { if: 'They want to think it over', then: 'Agree a day to talk again before you hang up, put it in your calendar, and send a two-line recap of what you would set up and the price.' },
      { if: 'They say no', then: 'Thank them and ask if you can check back in 3 months. If not, mark them lost in your Pipeline.' },
    ];

    // For sales.call_script: their facts, the member's notes, the worries they mentioned, the offer.
    const scriptNotes = [
      ...(lead.facts || []).slice(0, 3),
      notes,
      ...worries.filter((w) => w.mentioned).map((w) => `They may say: ${w.says}`),
      'What I offer: missed-call text back, an after-hours reply and a booking link on their own number and accounts, then monthly care. No contract.',
    ].filter(Boolean).join('\n');

    // The call on the member's calendar, with the card's key lines.
    let when = null;
    let calendar = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(input.callDate || ''))) {
      const hhmm = clock(input.callTime);
      when = { date: input.callDate, time: hhmm, label: nice(input.callDate, hhmm) };
      const desc = [`Price, said once: ${P.base}`, founding ? P.founding : '', `Ask: ${close.QUESTIONS.slice(0, 3).join(' / ')}`, `Close: ${closeLine}`, lead.website ? `Their website: ${lead.website}` : ''].filter(Boolean).join('\n\n');
      try {
        const ics = files.ics([{ uid: `frontdesk-call-${text.slug(lead.key || s, 40)}-${input.callDate}@127group.io`, title: `Call with ${owner ? `${owner} at ` : ''}${s}`, date: input.callDate, time: hhmm || undefined, minutes: 20, tz: time.tzOf(ctx), description: desc, url: /^https:\/\//.test(lead.website || '') ? lead.website : undefined }], { name: 'Sales calls', now: time.nowMs(ctx) });
        calendar = await save.saveFile(ctx, save.fileName(s, 'call', '.ics'), ics, 'text/calendar');
      } catch {
        calendar = null;
      }
    }

    // Call booked: this pack's lead (or a business typed in) moves to "call"; another pack's is the member's to move.
    let line = '';
    const leads = (ctx && ctx.leads) || {};
    const own = !lead.pack || lead.pack === 'frontdesk';
    try {
      if (lead.inPipeline && own && lead.key && typeof leads.upsert === 'function') {
        if (['found', 'contacted', 'replied'].includes(lead.stage)) {
          await leads.upsert({ key: lead.key, stage: 'call' });
          line = `Moved ${name} to Call booked in your Pipeline.`;
        }
      } else if (lead.inPipeline) {
        if (['found', 'contacted', 'replied'].includes(lead.stage)) line = `Move ${name} to Call booked in your Pipeline.`;
      } else if (typeof leads.upsert === 'function') {
        const dom = talk.domainOf(lead.website);
        await leads.upsert({ key: lead.key || (dom ? `site:${dom}` : `lead:${text.slug(name, 40)}`), name, company: name, source: 'Call prep', stage: 'call', links: lead.website ? { website: lead.website } : {}, data: { trade: lead.trade || 'contractors', city: lead.city || '' } });
        line = `Added ${name} to your Pipeline at Call booked.`;
      }
    } catch {
      line = '';
    }

    return {
      name,
      owner,
      inPipeline: !!lead.inPipeline,
      when,
      calendar,
      checkFirst,
      questions: close.QUESTIONS,
      priceLines: price,
      founding,
      clients,
      worries,
      close: closeLine,
      after,
      notes: scriptNotes,
      optionsText: prices.optionsText(n),
      price: n.care,
      line,
      me,
    };
  },
  view(out) {
    const p = out.priceLines || null;
    return views.blocks(
      views.metric(`Call with ${out.owner ? `${out.owner} at ` : ''}${out.name}`, out.when ? out.when.label : 'Not on your calendar yet', out.founding ? `Founding client ${out.clients + 1} of ${NICHE.first_clients.founding_count}` : undefined),
      views.cards(out.checkFirst.map((c) => ({ title: c.item, body: c.why, badge: 'Before the call' }))),
      views.copy('Questions to ask', out.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')),
      p ? views.copy('Say the price once', [p.say, p.founding || p.tools].filter(Boolean).join(' ')) : null,
      p ? views.text(`Prices from ${p.from}.`) : null,
      views.cards(out.worries.map((w) => ({ title: w.says, body: w.answer, badge: w.mentioned ? 'They mentioned this' : undefined }))),
      views.copy('The close', out.close),
      views.cards(out.after.map((a) => ({ title: a.if, body: a.then }))),
      views.file(out.calendar, 'The call, for your calendar (with these notes)'),
      out.line ? views.text(out.line) : null,
    );
  },
};
