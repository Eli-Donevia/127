module.exports = {
  id: 'gohighlevel',
  name: 'GoHighLevel',
  category: 'crm',
  auth: 'oauth',
  // A HighLevel Marketplace app, installed per sub-account (location).
  oauth: {
    name: 'HighLevel',
    authUrl: 'https://marketplace.gohighlevel.com/oauth/chooselocation',
    tokenUrl: 'https://services.leadconnectorhq.com/oauth/token',
    clientAuth: 'body',
    extra: {},
    keep: ['locationId', 'companyId'],
    account: 'locationId',
  },
  scopes: ['contacts.readonly', 'contacts.write', 'opportunities.readonly', 'opportunities.write', 'calendars/events.readonly'],
  base: 'https://services.leadconnectorhq.com',
  headers: { version: '2021-07-28' },
  reads: {
    contacts: { path: '/contacts/', query: { locationId: '{locationId}', limit: 100 }, list: 'contacts' },
    opportunities: { path: '/opportunities/search', query: { location_id: '{locationId}', limit: 100 }, list: 'opportunities' },
    pipelines: { path: '/opportunities/pipelines', query: { locationId: '{locationId}' }, list: 'pipelines' },
  },
  writes: {
    createContact: { method: 'POST', path: '/contacts/', body: { locationId: '{locationId}', firstName: '{firstName}', lastName: '{lastName}', email: '{email}', phone: '{phone}' } },
    addNote: { method: 'POST', path: '/contacts/{contactId}/notes', body: { body: '{text}' } },
    moveOpportunity: { method: 'PUT', path: '/opportunities/{id}', body: { pipelineStageId: '{stageId}' } },
  },
  card: { reads: 'Contacts, opportunities and pipelines', writes: 'New contacts, notes and opportunity stages' },
};
