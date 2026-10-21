module.exports = {
  id: 'pipedrive',
  name: 'Pipedrive',
  category: 'crm',
  auth: 'oauth',
  oauth: {
    name: 'Pipedrive',
    authUrl: 'https://oauth.pipedrive.com/oauth/authorize',
    tokenUrl: 'https://oauth.pipedrive.com/oauth/token',
    clientAuth: 'basic',
    // Each company has its own API address, given with the token.
    keep: ['api_domain'],
    revoke: { url: 'https://oauth.pipedrive.com/oauth/revoke', auth: 'basic', form: { token: '{refresh}', token_type_hint: 'refresh_token' } },
  },
  scopes: ['deals:full', 'activities:full'],
  base: { from: 'api_domain', pattern: '^https://[a-z0-9-]+\\.pipedrive\\.com$' },
  reads: {
    deals: { path: '/api/v2/deals', query: { status: 'open', limit: 100 }, list: 'data' },
    activities: { path: '/api/v2/activities', query: { limit: 100 }, list: 'data' },
    stages: { path: '/api/v2/stages', list: 'data' },
  },
  writes: {
    addNote: { method: 'POST', path: '/api/v1/notes', body: { content: '{text}', deal_id: '{dealId}' } },
    addActivity: { method: 'POST', path: '/api/v2/activities', body: { subject: '{subject}', type: 'task', due_date: '{due}', deal_id: '{dealId}' } },
    moveDeal: { method: 'PATCH', path: '/api/v2/deals/{id}', body: { stage_id: '{stageId}' } },
  },
  card: { reads: 'Open deals, activities and stages', writes: 'Notes, activities and deal stages' },
};
