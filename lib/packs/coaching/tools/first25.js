// "Your first 25" for coaching: up to 25 people from the member's own network and communities who
// match one kind of person and one result, each with a personal message and a free first session
// (free either way). A story is asked for only afterwards, with written consent and a disclosure
// line. Strict: nothing here claims earnings or results. Everyone is saved to the Pipeline (warm, with
// their message and follow-up) so Do my day hands them out, and the person and result are remembered
// for Your next 25, replies and the story caption.

const { first25, files, views, save, time, text, brain } = require('../../_kit');
const C = require('../../_kit/common');

const { plain } = text;
const MAX = 25;

function first25Tool(N) {
  const T = N.texts;
  return {
    name: 'coaching.list_first25',
    title: 'Your first 25 list',
    description: 'Up to 25 people from your own network and communities who match the one person and one result you coach, a personal message and follow-up for each, a free first session offer, the consent-first story ask, group asks and a pipeline CSV.',
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 1,
    timeoutSec: 30,
    input: {
      type: 'object',
      properties: {
        person: { type: 'string', maxLength: 80, title: 'The one kind of person you coach', description: `Like "${N.person_default}"` },
        result: { type: 'string', maxLength: 120, title: 'The one result they want', description: `Like "${N.result_default}"` },
        people: { type: 'string', maxLength: 6000, title: '25 people you know who match', description: 'One per line: name, how you know them. Nothing is pulled from your phone.' },
        groups: { type: 'string', maxLength: 2000, title: 'Groups you belong to (optional)', description: 'Alumni groups, associations, workplace or online communities, one per line' },
        exclude: { type: 'string', maxLength: 4000, title: 'Names already contacted (optional)' },
      },
    },
    output: { type: 'object', required: ['people', 'plan'], properties: { people: { type: 'array' }, plan: { type: 'array' }, file: { type: 'object' }, saved: { type: 'integer' } } },
    async run(input, ctx) {
      const me = C.who(ctx, input);
      const person = plain(input.person || N.person_default).replace(/[.]$/, '');
      const result = plain(input.result || N.result_default).replace(/^to /i, '').replace(/[.]$/, '');
      const skip = new Set(C.linesOf(input.exclude, 300).map((s) => s.toLowerCase()));
      const people = first25
        .parsePeople(input.people, { max: 60 })
        .filter((p) => !skip.has(p.name.toLowerCase()))
        .slice(0, MAX)
        .map((p, i) => {
          const v = { greet: p.greet, what: N.what, person, result, name: p.name };
          return { ...p, message: C.fill(T.people[(i + p.name.length) % T.people.length], v), follow_up: C.fill(T.follow_up, v) };
        });
      const groups = C.linesOf(input.groups, 10).map((g) => ({ group: g, ask: C.fill(T.group_ask, { person, result }) }));
      const today = time.today(ctx);
      const day = (n) => time.shortDate(time.addDays(today, n));
      const plan = [
        `Today: send ${people.length ? `the ${people.length}` : '25'} messages. Short and personal beats polished.`,
        `${day(2)}: book the free sessions. Free means free, whatever they think afterwards.`,
        `${day(4)}: follow up once with anyone who hasn't answered, and ask each group's organizer before posting.`,
        `After each free session: send the story ask. Only share a story they approve in writing, with the disclosure line.`,
        `${day(7)}: run this again with everyone you've contacted in "Names already contacted".`,
      ];
      const rows = people.map((p) => ({ name: p.name, contact: p.phone || p.email || '', note: p.note, message: p.message, follow: p.follow_up, on: time.addDays(today, 4), status: 'To send' }));
      const csv = files.csv(rows, [
        { key: 'name', label: 'Name' },
        { key: 'contact', label: 'Contact' },
        { key: 'note', label: 'How you know them' },
        { key: 'message', label: 'Message' },
        { key: 'follow', label: 'Follow-up' },
        { key: 'on', label: 'Follow up on' },
        { key: 'status', label: 'Status' },
      ]);
      const file = await save.saveFile(ctx, save.fileName('coaching', 'first 25', today, '.csv'), csv);
      const saved = await C.saveRows(ctx, people.map((p, i) => C.personLead(p, { dm: p.message, follow1: p.follow_up, subject: T.next_subject, source: 'Coaching: first 25', score: 90 - Math.min(15, i) })));
      if (input.person || input.result) await brain.remember(ctx, 'focus', { ...C.focusOf(ctx, N), person, result });
      return {
        card: C.crowdCard(ctx, N),
        crowd: `${person} who want to ${result}`,
        rules: N.rules,
        people,
        groups,
        story_ask: T.story_ask,
        disclosure: C.fill(T.disclosure, { name: 'Jordan' }),
        plan,
        first: people[0] ? { to: people[0].name, text: people[0].message } : null,
        file,
        saved,
      };
    },
    view(out) {
      const kit = require('../../_kit');
      return views.blocks(
        views.metric('Your first 25', `${out.people.length} ready`, `Crowd: ${out.crowd}${out.saved ? `. ${out.saved} saved to your Pipeline for Do my day` : ''}`),
        views.text(`Rules for every message and story: ${out.rules.join(' ')}`),
        kit.crowd.blocks(out.card),
        out.first ? views.copy(`First message: to ${out.first.to}`, out.first.text) : views.text('Add up to 25 people you know who match, one per line, to get a personal message for each.'),
        out.people.length ? views.table([{ key: 'name', label: 'Person' }, { key: 'note', label: 'How you know them' }, { key: 'message', label: 'Message' }, { key: 'follow_up', label: 'Follow-up' }], out.people) : null,
        out.groups.length ? views.table([{ key: 'group', label: 'Group' }, { key: 'ask', label: 'Ask the organizer first' }], out.groups) : null,
        views.copy('After a free session: the story ask (consent first)', out.story_ask),
        views.copy('Disclosure line for any story you share', out.disclosure),
        views.text(`Plan: ${out.plan.join(' ')}`),
        views.file(out.file, 'Your first 25 (CSV for your pipeline)'),
      );
    },
  };
}

module.exports = { first25Tool };
