module.exports = {
  id: 'close',
  name: 'Close',
  category: 'crm',
  auth: 'key',
  key: {
    fields: [{ name: 'key', label: 'API key', placeholder: 'api_...', secret: true }],
    pattern: '^api_[A-Za-z0-9._-]{10,}$',
    steps: ['In Close, go to <strong>Settings</strong>, <strong>Developer</strong>, <strong>API Keys</strong>, and create one named 127 HQ.', 'Copy the key and paste it below.'],
    // HTTP Basic with the key as the user name and no password.
    auth: { basic: '{key}:' },
    test: '/api/v1/me/',
  },
  base: 'https://api.close.com',
  reads: {
    leads: { path: '/api/v1/lead/', query: { _limit: 100, _fields: 'id,display_name,status_label,date_created' }, list: 'data' },
    opportunities: { path: '/api/v1/opportunity/', query: { _limit: 100, _fields: 'id,lead_name,value,status_label,date_won' }, list: 'data' },
  },
  writes: {
    addNote: { method: 'POST', path: '/api/v1/activity/note/', body: { lead_id: '{leadId}', note: '{text}' } },
    addTask: { method: 'POST', path: '/api/v1/task/', body: { lead_id: '{leadId}', text: '{text}', date: '{due}' } },
  },
  card: { reads: 'Leads and opportunities, without email addresses or phone numbers', writes: 'Notes and tasks' },
};
