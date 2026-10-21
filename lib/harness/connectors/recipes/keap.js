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
  },
  // Contacts and notes only: Privacy 7A's CRM row has no orders or tags (Legal L93).
  writes: {
    addNote: { method: 'POST', path: '/v1/notes', body: { contact_id: '{contactId}', title: '{title}', body: '{text}' } },
  },
  card: { reads: 'Contacts, without email addresses or phone numbers', writes: 'Notes' },
};
