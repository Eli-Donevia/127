// Reads the member's contacts (a phone's .vcf export, a Google or Outlook CSV, or pasted lines),
// cleans the phone numbers, merges duplicates and sets businesses aside.

const { views } = require('../../_kit');
const C = require('../lib/contacts');

module.exports = {
  name: 'warm.import_contacts',
  title: 'Import my contacts',
  description: 'Reads contacts from a vCard (.vcf) export, a Google or Outlook contacts CSV, or pasted lines, merges duplicates by phone or email and sets businesses aside.',
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 1,
  input: {
    type: 'object',
    properties: {
      contacts: { type: 'string', title: 'Your contacts', description: 'Paste a .vcf or contacts CSV export, or one person per line: name, phone, a note about them.', maxLength: 2000000 },
    },
    required: ['contacts'],
  },
  output: { type: 'object', properties: { people: { type: 'array' }, format: { type: 'string' }, read: { type: 'number' }, merged: { type: 'number' }, businesses: { type: 'number' } }, required: ['people'] },
  async run(input, ctx) {
    // An empty paste stops here, in one plain line, before any other step runs.
    if (!String(input.contacts || '').trim()) throw new Error('Paste at least one name');
    const { kind, people } = C.parseAny(input.contacts || '');
    if (!people.length) throw new Error('No contacts found. Paste a .vcf or CSV export, or one person per line.');
    const all = C.dedupe(people.filter((p) => p.name || p.phones.length || p.emails.length));
    const biz = all.filter(C.isBusiness);
    // People with a number or an email first; names typed by hand with neither still count (the
    // member reaches them their own way), so a short pasted list never comes back empty.
    let persons = all.filter((p) => !C.isBusiness(p) && p.name && (p.phones.length || p.emails.length));
    if (!persons.length) persons = all.filter((p) => !C.isBusiness(p) && p.name);
    if (!persons.length) throw new Error(biz.length ? 'Paste at least one name. Businesses are set aside: this list is for people you know.' : 'Paste at least one name');
    ctx.log(`Read ${people.length} ${kind} contacts: ${persons.length} people, ${people.length - all.length} duplicates merged, ${biz.length} businesses set aside`);
    return {
      format: kind,
      read: people.length,
      merged: people.length - all.length,
      businesses: biz.length,
      // Kept under the 256 KB step limit: 800 people, short notes.
      people: persons.slice(0, 800).map((p) => ({ name: p.name, first: p.first, phones: p.phones.slice(0, 2), emails: p.emails.slice(0, 2), notes: [p.notes.join('. ').slice(0, 120)].filter(Boolean), org: p.org.slice(0, 60), title: p.title.slice(0, 60), labels: p.labels.slice(0, 3) })),
    };
  },
  view(out) {
    return views.blocks(
      views.metric('People found', out.people.length, `${out.read} contacts read from ${out.format}`),
      views.metric('Duplicates merged', out.merged),
      views.metric('Businesses set aside', out.businesses),
    );
  },
};
