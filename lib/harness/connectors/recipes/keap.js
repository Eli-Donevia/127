module.exports = {
  id: 'keap',
  name: 'Keap',
  category: 'crm',
  auth: 'oauth',
  oauth: {
    name: 'Keap',
    authUrl: 'https://accounts.infusionsoft.com/app/oauth/authorize',
    tokenUrl: 'https://api.infusionsoft.com/token',
    clientAuth: 'body',
  },
  scopes: ['full'],
  base: 'https://api.infusionsoft.com/crm/rest',
  reads: {
    contacts: { path: '/v1/contacts', query: { limit: 100 }, list: 'contacts' },
    tags: { path: '/v1/tags', query: { limit: 200 }, list: 'tags' },
    orders: { path: '/v1/orders', query: { limit: 100 }, list: 'orders' },
  },
  writes: {
    applyTag: { method: 'POST', path: '/v1/tags/{tagId}/contacts', body: { ids: '{contactIds}' } },
    addNote: { method: 'POST', path: '/v1/notes', body: { contact_id: '{contactId}', title: '{title}', body: '{text}' } },
  },
  card: { reads: 'Contacts, tags and orders', writes: 'Tags and notes' },
};
