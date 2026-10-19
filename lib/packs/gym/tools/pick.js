// gym.pick: finds one of the member's gyms by name, with everything the pack learned about it, so a
// workflow like "Prep for a call" can start from a name the member picks or types.

const P = require('../lib/pipeline');

module.exports = {
  name: 'gym.pick',
  title: 'Pick a gym',
  description: 'Finds a gym from your list by name, with its gaps, ideas and contact details.',
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 0,
  input: {
    type: 'object',
    properties: { name: { type: 'string', title: 'Which gym', description: 'A gym from your list' } },
    required: ['name'],
  },
  output: { type: 'object', properties: { row: { type: 'object' }, rows: { type: 'array' }, stage: { type: 'string' } }, required: ['row', 'rows'] },

  async run(input, ctx) {
    const p = await P.load(ctx);
    const lead = P.find(p, input.name);
    if (!lead) throw new Error(`"${input.name}" isn't on your list yet. Run "Check any gym" on it first.`);
    const row = lead.row || { key: lead.key, name: lead.name, gym: { name: lead.name, category: lead.category, website: lead.website, lat: lead.lat, lon: lead.lon }, contact: { email: lead.email, phone: lead.phone, instagram: lead.instagram, owner: lead.owner ? { name: lead.owner, role: 'owner' } : null }, gaps: [], ideas: [] };
    return { row, rows: [row], stage: lead.stage, name: lead.name };
  },

  view(out) {
    return [{ type: 'text', text: `${out.name}: "${out.stage}" in your Pipeline.` }];
  },
};
