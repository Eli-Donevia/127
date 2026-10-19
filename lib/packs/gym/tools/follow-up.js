// gym.follow_up: the follow-up messages that are due, for the gyms the member contacted.
// Uses the drafts gym.write_outreach already wrote, so the story stays the same.

const { plain } = require('../lib/util');

module.exports = {
  name: 'gym.follow_up',
  title: 'Follow up',
  description: "Lists the follow-up message due today for each gym you contacted (day 3, 7 or 14), ready to copy. Skip any gym that already replied.",
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  input: {
    type: 'object',
    properties: {
      messages: { type: 'array', title: 'Messages you sent', description: 'Outputs of gym.write_outreach' },
      day: { type: 'integer', title: 'Day', enum: [3, 7, 14], default: 3 },
    },
    required: ['messages'],
  },
  output: { type: 'object', properties: { due: { type: 'array' } }, required: ['due'] },

  async run(input) {
    const day = input.day || 3;
    const due = (input.messages || [])
      .filter((m) => m && !m.error && Array.isArray(m.followUps))
      .map((m) => {
        const f = m.followUps.find((x) => x.day === day) || m.followUps[0];
        return { gym: m.gym, key: m.key, day: f.day, channel: f.channel, text: plain(f.text) };
      });
    return { due, day };
  },

  view(out) {
    if (!out.due.length) return [{ type: 'text', text: 'Nothing due today.' }];
    return out.due.map((d) => ({ type: 'copy', label: `${d.gym}, day ${d.day} (${d.channel})`, text: d.text }));
  },
};
