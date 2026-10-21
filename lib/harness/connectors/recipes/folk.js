module.exports = {
  id: 'folk',
  name: 'folk',
  category: 'crm',
  auth: 'key',
  key: {
    fields: [{ name: 'key', label: 'API key', placeholder: 'Paste it here', secret: true }],
    steps: ['In folk, go to <strong>Settings</strong>, <strong>API</strong>, and create a key named 127 HQ.', 'Copy the key and paste it below.'],
    auth: { header: 'authorization', value: 'Bearer {key}' },
    test: '/v1/users/me',
  },
  base: 'https://api.folk.app',
  reads: {
    people: { path: '/v1/people', query: { limit: 100 }, list: 'data.items' },
    groups: { path: '/v1/groups', query: { limit: 100 }, list: 'data.items' },
  },
  writes: {
    createPerson: { method: 'POST', path: '/v1/people', body: { firstName: '{firstName}', lastName: '{lastName}', groups: '{groups}' } },
  },
  card: { reads: 'People and groups, without email addresses or phone numbers', writes: 'New people' },
};
