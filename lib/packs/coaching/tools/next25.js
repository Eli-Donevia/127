// "Your next 25" for coaching: the next batch (10 to 100) of people from the member's own network
// who match the one person and one result, skipping everyone already in the Pipeline (kit
// leads.known), each saved with a message and follow-up for Do my day. Coaching has no map search,
// so the run also gives where to look for more people and the ask for each group's organizer.
// Safe to repeat every Monday: the CSV is dated and nobody comes back twice.

const { first25, files, views, save, time, text, brain, leads } = require('../../_kit');
const C = require('../../_kit/common');

const { plain } = text;

function next25Tool(N) {
  const T = N.texts;
  return {
    name: 'coaching.list_next25',
    title: 'Your next 25 list',
    description: 'The next 25 (10 to 100) people you know who match the one person and one result you coach, skipping everyone already in your Pipeline, each saved with a message for Do my day, plus where to look for more and group asks.',
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 1,
    timeoutSec: 30,
    input: {
      type: 'object',
      properties: {
        people: { type: 'string', format: 'textarea', maxLength: 6000, title: 'New people you know who match', description: 'One per line: name, how you know them. Anyone already in your Pipeline is skipped.' },
        count: { type: 'integer', minimum: C.BATCH_MIN, maximum: C.BATCH_MAX, default: C.BATCH_DEFAULT, title: 'How many', description: '10 to 100' },
        person: { type: 'string', maxLength: 80, title: 'The one kind of person you coach (optional)', description: 'Left empty, the one from your first 25' },
        result: { type: 'string', maxLength: 120, title: 'The one result they want (optional)', description: 'Left empty, the one from your first 25' },
        groups: { type: 'string', maxLength: 2000, title: 'New groups you belong to (optional)', description: 'Alumni groups, associations, workplace or online communities, one per line' },
      },
    },
    output: { type: 'object', required: ['people', 'prompts', 'plan'], properties: { people: { type: 'array' }, prompts: { type: 'array' }, groups: { type: 'array' }, plan: { type: 'array' }, file: { type: ['object', 'null'] }, saved: { type: 'integer' }, skipped: { type: 'integer' } } },
    async run(input, ctx) {
      const focus = C.focusOf(ctx, N);
      const person = plain(input.person || focus.person || N.person_default).replace(/[.]$/, '');
      const result = plain(input.result || focus.result || N.result_default).replace(/^to /i, '').replace(/[.]$/, '');
      const batch = C.batchOf(input.count);
      const known = await leads.known(ctx);
      let skipped = 0;
      const people = first25
        .parsePeople(input.people, { max: C.BATCH_MAX * 2 })
        .filter((p) => {
          const old = C.isKnown(known, { key: C.keyFor('person', p.name), name: p.name });
          if (old) skipped += 1;
          return !old;
        })
        .slice(0, batch)
        .map((p, i) => {
          const v = { greet: p.greet, person, result };
          return { ...p, message: C.fill(T.next_people[(i + p.name.length) % T.next_people.length], v), follow_up: C.fill(T.next_follow_up, v) };
        });
      const groups = C.linesOf(input.groups, 10).map((g) => ({ group: g, ask: C.fill(T.group_ask, { person, result }) }));
      const prompts = (N.next.prompts || []).map((p) => C.fill(p, { person }));
      const today = time.today(ctx);
      const day = (n) => time.shortDate(time.addDays(today, n));
      const saved = await C.saveRows(ctx, people.map((p, i) => C.personLead(p, { dm: p.message, follow1: p.follow_up, subject: T.next_subject, source: 'Coaching: next 25', score: 88 - Math.min(15, i) })));
      if (input.person || input.result) await brain.remember(ctx, 'focus', { ...focus, person, result });
      let file = null;
      if (people.length) {
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
        file = await save.saveFile(ctx, save.fileName('coaching', 'next 25', today, '.csv'), csv);
      }
      const plan = [
        people.length ? `Today: send the ${people.length} ${people.length === 1 ? 'message' : 'messages'}. Do my day hands them out too.` : `Today: pick ${batch} names from the places below and run this again with them.`,
        groups.length ? `${day(1)}: ask each group's organizer before you post anything.` : '',
        `${day(4)}: one follow-up to anyone who hasn't answered, then let it go.`,
        'Every Monday: run this again with new names. Nobody already in your Pipeline comes back.',
      ].filter(Boolean);
      return { crowd: `${person} who want to ${result}`, rules: N.rules, people, groups, prompts, plan, file, saved, skipped, batch, first: people[0] ? { to: people[0].name, text: people[0].message } : null };
    },
    view(out) {
      return views.blocks(
        views.metric(`Your next ${out.batch}`, `${out.people.length} new`, `Crowd: ${out.crowd}.${out.skipped ? ` ${out.skipped} already in your Pipeline skipped.` : ''}${out.saved ? ` ${out.saved} saved for Do my day.` : ''}`),
        out.first ? views.copy(`First message: to ${out.first.to}`, out.first.text) : views.text(out.skipped ? 'Everyone you listed is already in your Pipeline. Add new names from the places below.' : 'Add people you know who match, one per line, to get a personal message for each.'),
        out.people.length ? views.table([{ key: 'name', label: 'Person' }, { key: 'note', label: 'How you know them' }, { key: 'message', label: 'Message' }, { key: 'follow_up', label: 'Follow-up' }], out.people) : null,
        views.copy('Where to look for the next names', out.prompts.map((p, i) => `${i + 1}. ${p}`).join('\n')),
        out.groups.length ? views.table([{ key: 'group', label: 'Group' }, { key: 'ask', label: 'Ask the organizer first' }], out.groups) : null,
        views.text(`Plan: ${out.plan.join(' ')}`),
        views.text(`Rules for every message: ${out.rules.slice(0, 2).join(' ')}`),
        views.file(out.file, `Your next ${out.batch} (CSV)`),
      );
    },
  };
}

module.exports = { next25Tool };
