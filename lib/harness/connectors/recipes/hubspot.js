module.exports = {
  id: 'hubspot',
  name: 'HubSpot',
  category: 'crm',
  auth: 'oauth',
  // HubSpot's provider is already in oauth.js; the recipe adds the write scopes.
  provider: 'hubspot',
  scopes: ['crm.objects.contacts.read', 'crm.objects.contacts.write', 'crm.objects.deals.read', 'crm.objects.deals.write'],
  base: 'https://api.hubapi.com',
  reads: {
    deals: { path: '/crm/v3/objects/deals', query: { limit: 100, properties: 'dealname,amount,dealstage,closedate,pipeline' }, list: 'results' },
    contacts: { path: '/crm/v3/objects/contacts', query: { limit: 100, properties: 'firstname,lastname,lifecyclestage,createdate' }, list: 'results' },
    pipelines: { path: '/crm/v3/pipelines/deals', list: 'results' },
  },
  writes: {
    createContact: { method: 'POST', path: '/crm/v3/objects/contacts', body: { properties: { firstname: '{firstName}', lastname: '{lastName}', email: '{email}' } } },
    addNote: { method: 'POST', path: '/crm/v3/objects/notes', body: { properties: { hs_note_body: '{text}', hs_timestamp: '{now}' } } },
    addTask: { method: 'POST', path: '/crm/v3/objects/tasks', body: { properties: { hs_task_subject: '{subject}', hs_timestamp: '{due}' } } },
    moveDeal: { method: 'PATCH', path: '/crm/v3/objects/deals/{id}', body: { properties: { dealstage: '{stage}' } } },
  },
  card: { reads: 'Contacts, deals and pipeline stages', writes: 'New contacts, notes, tasks and deal stages' },
};
