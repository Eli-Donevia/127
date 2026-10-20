// "Your first 25" for an idea: 25 conversations with people who might buy it, to test one idea before
// building anything. Up to 15 people the member knows (a note asking for 15 minutes about the
// problem, not a pitch) and, when the buyers are a kind of local business, up to 10 of them from
// OpenStreetMap (an email with the address line and opt-out, and an in-person line). The questions
// ask what people did in the past, never whether they'd buy. A conversation log CSV to fill in, which
// the scorecard reads. Nothing is sent. People and real places go to the Pipeline.

const { views, save, time, text, files, first25, crowd, brain } = require('../../_kit');
const { ADDRESS_HOLD, optOut } = require('../../_kit/outreach');
const K = require('../lib/idea');
const L = require('../lib/local');

const { plain } = text;
const { C, N } = K;

const NOTES = [
  "Hi {greet}, can I ask you something? I'm looking into {topic}, and I think you've dealt with it. Could I buy you a coffee or call for 15 minutes and hear how it went? I'm not selling anything, I just want to learn.",
  "Hey {greet}! Quick favor: I'm trying to understand how people handle {topic}. You came to mind. Got 15 minutes this week to tell me about the last time it came up for you?",
  "Hi {greet}, I'm researching {topic} before I decide whether to start something. Would you tell me about your experience with it? 15 minutes, on the phone or over coffee, your pick.",
];
const FOLLOW = 'Hi {greet}, no pressure on my last note. If someone else you know deals with {topic}, an intro would help a lot too.';
const BIZ = "I'm {me}, and I'm looking into how {their} handle {topic}. I'm not selling anything: I'd like 15 minutes to hear how it works at {biz} today. Would someone there have time this week?";
const WALK = 'Hi, is the owner or manager around? I\'m {me}, and I\'m learning how {their} handle {topic}. Could I ask them a few questions sometime this week, 15 minutes?';

const LOG_COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'kind', label: 'Who' },
  { key: 'contact', label: 'Contact' },
  { key: 'message', label: 'First message' },
  { key: 'talked', label: 'Talked' },
  { key: 'had', label: 'Had the problem' },
  { key: 'spent', label: 'Already spends' },
  { key: 'committed', label: 'Committed' },
  { key: 'intro', label: 'Intro' },
  { key: 'notes', label: 'Notes' },
];

module.exports = {
  name: 'idea.list_first25',
  title: 'Your first 25 conversations',
  description: 'Up to 15 people you know and up to 10 local businesses (when your buyers are businesses) to ask about the problem your idea solves, with a note for each, the questions to ask and a conversation log.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  wants: ['osm'],
  credits: 2,
  timeoutSec: 240,
  input: {
    type: 'object',
    required: ['idea'],
    properties: {
      idea: { type: 'string', maxLength: 140, title: 'Your idea, in one line', description: 'Like "weekly meal prep for shift nurses"' },
      problem: { type: 'string', maxLength: 160, title: 'The problem it solves, in their words (optional)', description: 'Like "cooking after a 12-hour shift"' },
      who: { type: 'string', maxLength: 120, title: 'Who has the problem (optional)', description: 'Like "nurses on night shifts"' },
      people: { type: 'string', format: 'textarea', maxLength: 4000, title: 'Up to 15 people who might have the problem', description: 'One per line: name, how you know them, phone or email if you like.' },
      businesses: { type: 'string', maxLength: 80, title: 'If your buyers are businesses: what kind (optional)', description: 'Like "hair salons", "gyms" or "dentists". We list ones near you from OpenStreetMap.' },
      city: { type: 'string', maxLength: 80, title: 'Your city and state (optional)' },
      exclude: { type: 'string', maxLength: 4000, title: 'Names already contacted (optional)' },
    },
  },
  output: {
    type: 'object',
    required: ['people', 'places', 'questions'],
    properties: { card: { type: 'object' }, idea: { type: 'string' }, people: { type: 'array' }, places: { type: 'array' }, questions: { type: 'array' }, avoid: { type: 'array' }, plan: { type: 'array' }, first: { type: ['object', 'null'] }, file: { type: 'object' }, notes: { type: 'array' }, saved: { type: 'integer' }, sample: { type: 'boolean' } },
  },
  async run(input, ctx) {
    const m = K.me(ctx, input);
    const today = time.today(ctx);
    const topic = K.problemPhrase(m).replace(/^you (dealt with|had to deal with) /, '');
    const skip = new Set(C.linesOf(input.exclude, 300).map((s) => s.toLowerCase()));
    const people = first25
      .parsePeople(input.people, { max: 40 })
      .filter((p) => !skip.has(p.name.toLowerCase()))
      .slice(0, 15)
      .map((p, i) => ({ ...p, message: C.fill(NOTES[(i + p.name.length) % NOTES.length], { greet: p.greet, topic }), follow_up: C.fill(FOLLOW, { greet: p.greet, topic }) }));

    const notes = [];
    let places = [];
    let held = false;
    const want = plain(input.businesses || '');
    if (want) {
      const cat = L.places().categoryOf(want);
      if (cat.custom || !cat.osm || !cat.osm.length) notes.push(`We can't list "${want}" from the map. Try a common kind like salons, gyms, dentists or cafes, or add the businesses you know to the people list.`);
      else if (!m.city) notes.push('Add your city and state for the map search.');
      else {
        const type = { id: cat.id, label: cat.label, kit: cat.id, their_customers: cat.many };
        const found = await L.findLocal(ctx, [type], { city: m.city, limit: Math.min(10, Math.max(5, 25 - people.length)), skip });
        held = found.held;
        notes.push(...found.notes);
        places = found.places.map((b) => {
          const vars = { me: m.first || 'a local founder', their: cat.many, topic, biz: b.name };
          const body = C.fill(BIZ, vars);
          return {
            ...b,
            kind: cat.label,
            message: `Hi ${b.name} team, ${body}`,
            email: [`Hi ${b.name} team,`, body, [m.first, ADDRESS_HOLD].filter(Boolean).join('\n'), optOut('a short research chat')].join('\n\n'),
            walk_in: C.fill(WALK, vars),
          };
        });
      }
    }
    const anySample = places.some((b) => b.sample);
    if (anySample) notes.push('Places marked (sample) are made up so you can see how it works. They are never saved to your Pipeline.');
    if (anySample && held) notes.push(L.places().HELD_NOTE);
    if (!people.length) notes.push('Add up to 15 people who might have the problem, one per line.');

    const rows = people.map((p, i) => C.personLead(p, { dm: p.message, follow1: p.follow_up, subject: `Can I ask you about ${topic}?`, source: 'Idea test: first 25', score: 88 - Math.min(15, i) }));
    for (const b of places) {
      if (b.sample) continue;
      const lead = C.placeLead(b, { id: 'buyers', label: b.kind, their_customers: 'team' }, { me: { first: m.first }, what: 'a short research chat', area: m.city.split(',')[0] || 'town', source: 'Idea test: first 25 (OpenStreetMap)', weight: 2 });
      rows.push({ ...lead, msg: { dm: b.message, subject: `15 minutes on how you handle ${topic}?`, email: b.email, walkin: b.walk_in } });
    }
    const saved = await C.saveRows(ctx, rows);
    await brain.remember(ctx, 'idea', m.idea);
    if (input.who) await brain.remember(ctx, 'who', m.who);
    if (input.problem) await brain.remember(ctx, 'problem', m.problem);

    const questions = K.questionsFor(m);
    const day = (n) => time.shortDate(time.addDays(today, n));
    const plan = [
      `Today: send the ${people.length || 15} notes. Ask for a story, not an opinion.`,
      places.length ? `${day(1)}: call or visit the businesses; email the ones with only a website.` : `${day(1)}: ask the first people you talk to who else has the problem.`,
      `${day(2)} to ${day(5)}: talk to as many as you can. Write down what they say in the log the same day.`,
      `${day(6)}: run the scorecard on your log.`,
    ];
    const csvRows = [
      ...people.map((p) => ({ name: p.name, kind: 'Person you know', contact: p.phone || p.email || '', message: p.message })),
      ...places.map((b) => ({ name: b.name, kind: b.kind, contact: [b.phone, b.website, b.address].filter(Boolean).join(' '), message: b.walk_in })),
    ];
    const credit = L.places().creditLine(places);
    if (credit) csvRows.push({ name: credit });
    const file = await save.saveFile(ctx, save.fileName(m.idea, 'conversation log', today, '.csv'), files.csv(csvRows, LOG_COLUMNS));
    return {
      card: C.crowdCard(ctx, N),
      idea: m.idea,
      people,
      places,
      questions,
      avoid: K.AVOID,
      plan,
      first: people[0] ? { to: people[0].name, text: people[0].message } : places[0] ? { to: places[0].name, text: places[0].message } : null,
      file,
      notes,
      saved,
      sample: anySample,
    };
  },
  view(out) {
    return views.blocks(
      views.metric('Your first 25 conversations', `${out.people.length + out.places.length} ready`, `To test: ${out.idea}. ${out.people.length} people, ${out.places.length} businesses${out.saved ? `. ${out.saved} saved to your Pipeline` : ''}`),
      crowd.blocks(out.card),
      out.first ? views.copy(`First note: to ${out.first.to}`, out.first.text) : null,
      views.table([{ key: 'q', label: 'Ask' }, { key: 'why', label: 'Why' }], out.questions),
      views.text(`Don't ask: ${out.avoid.join(' ')}`),
      out.people.length ? views.table([{ key: 'name', label: 'Person' }, { key: 'note', label: 'How you know them' }, { key: 'message', label: 'Note' }], out.people) : null,
      out.places.length ? views.table([{ key: 'name', label: 'Business' }, { key: 'address', label: 'Address' }, { key: 'walk_in', label: 'In person' }, { key: 'email', label: 'Email' }], out.places) : null,
      views.text(`Plan: ${out.plan.join(' ')}`),
      out.notes.length ? views.text(out.notes.join(' ')) : null,
      L.places().creditBlocks(out.places),
      views.file(out.file, 'Conversation log (CSV): fill in Had the problem, Already spends, Committed and Intro with yes or no'),
    );
  },
};
