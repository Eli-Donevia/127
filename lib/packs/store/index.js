// The Store's pack (W7, STORE-SCHEMA.md): "Make it mine" fills a Store template from the member's
// business brain and saves it to their Library. Started from a Store item's page in HQ
// (/app/hq/store/:id, lib/store-routes.js), so the workflow is hidden: no card on Start, nothing on
// the AI link's list. Code only, nothing goes to Anthropic.

const SAFE_ID = '^[a-z0-9][a-z0-9-]{0,80}$';

module.exports = {
  id: 'store',
  title: 'Store',
  version: '0.1.0',
  summary: 'Fills any Store template with your business details in one tap.',
  niches: ['any'],
  business: false,
  tools: [require('./tools/make-it-mine')],
  workflows: [
    {
      id: 'store.make_it_mine',
      title: 'Make it mine',
      promise: 'Your template with your business name, links and details already in it, saved to your Library.',
      minutes: 1,
      tier: 'free', // the tool checks the item's own plan
      job: 'ops',
      hidden: true,
      inputs: {
        type: 'object',
        properties: {
          item: { type: 'string', title: 'Store item', pattern: SAFE_ID },
          email: { type: 'string', title: 'Email for customers', format: 'email', maxLength: 120 },
          phone: { type: 'string', title: 'Phone for customers', maxLength: 40 },
        },
        required: ['item'],
      },
      steps: [{ id: 'make', tool: 'store.make_it_mine', input: { item: '$inputs.item', email: '$inputs.email', phone: '$inputs.phone' } }],
      result: ['make'],
    },
  ],
};
