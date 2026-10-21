// Twenty, the open-source CRM: the member's own server (twenty.com's cloud or one they host).
module.exports = {
  id: 'twenty',
  name: 'Twenty',
  category: 'crm',
  auth: 'key',
  insider: true,
  key: {
    fields: [
      { name: 'server', label: 'Server address', placeholder: 'https://crm.yourbusiness.com', secret: false },
      { name: 'key', label: 'API key', placeholder: 'Paste it here', secret: true },
    ],
    steps: ['In Twenty, go to <strong>Settings</strong>, <strong>APIs &amp; Webhooks</strong>, and create a key named 127 HQ.', 'Paste your Twenty address (api.twenty.com for Twenty Cloud) and the key below.'],
    auth: { header: 'authorization', value: 'Bearer {key}' },
    test: '/rest/people?limit=1',
  },
  base: { from: 'server', selfHosted: true },
  reads: {
    people: { path: '/rest/people', query: { limit: 60 }, list: 'data.people' },
    companies: { path: '/rest/companies', query: { limit: 60 }, list: 'data.companies' },
    opportunities: { path: '/rest/opportunities', query: { limit: 60 }, list: 'data.opportunities' },
  },
  writes: {
    createPerson: { method: 'POST', path: '/rest/people', body: { name: { firstName: '{firstName}', lastName: '{lastName}' } } },
    addNote: { method: 'POST', path: '/rest/notes', body: { title: '{title}' } },
  },
  card: { reads: 'People, companies and opportunities, without email addresses or phone numbers', writes: 'New people and notes' },
};
