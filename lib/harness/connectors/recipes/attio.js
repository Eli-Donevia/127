module.exports = {
  id: 'attio',
  name: 'Attio',
  category: 'crm',
  auth: 'oauth',
  oauth: {
    name: 'Attio',
    authUrl: 'https://app.attio.com/authorize',
    tokenUrl: 'https://app.attio.com/oauth/token',
    clientAuth: 'body',
  },
  scopes: [],
  base: 'https://api.attio.com',
  reads: {
    objects: { path: '/v2/objects', list: 'data' },
    lists: { path: '/v2/lists', list: 'data' },
    // Attio queries records with a POST; it changes nothing.
    records: { method: 'POST', path: '/v2/objects/{object}/records/query', body: { limit: 100 }, list: 'data' },
  },
  writes: {
    createRecord: { method: 'POST', path: '/v2/objects/{object}/records', body: { data: { values: '{values}' } } },
    addNote: { method: 'POST', path: '/v2/notes', body: { data: { parent_object: '{object}', parent_record_id: '{recordId}', title: '{title}', format: 'plaintext', content: '{text}' } } },
  },
  card: { reads: 'Objects, lists and records', writes: 'New records and notes' },
};
