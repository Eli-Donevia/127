// Every app the Connections gallery lists (v2/turnkey/BUILD-PLAN.md W1), in gallery order.
//
// auth:
//   builtin  HQ v1's own connections on the same page (Stripe key, Shopify webhook, the 127 link, the AI link)
//   key      the member pastes a key or token; works as soon as its switch is on (apps.js tests it)
//   oauth    "Sign in with": needs 127's own app with that provider (oauth.js), so it's Coming until
//            OAUTH_<PROVIDER>_ID and _SECRET are set
//   link     reaches 127 through the member's 127 link (Zapier, Make, n8n)
//   ai       reaches 127 through the member's AI link (Claude, ChatGPT)
//
// reads / writes: what 127 does with the account, in the member's words. Writes always stop for the
// member's OK first and land in the Activity log (log.js).
//
// Legal's rulings (legal/handoffs/turnkey.md, L76):
//   ai: false     its data goes to no AI, so packs can't use it; only views with no AI (dashboards) read it
//   keepHours     the platform's storage limit, which beats HQ's 180 days for runs that read it (O5)
//   waits         held for everyone, admins too, until the reason clears; the connector page says why

const CATEGORIES = [
  { id: 'money', name: 'Money' },
  { id: 'store', name: 'Store' },
  { id: 'email', name: 'Email and CRM' },
  { id: 'calendar', name: 'Calendar' },
  { id: 'social', name: 'Social' },
  { id: 'ads', name: 'Ads' },
  { id: 'knowledge', name: 'Knowledge' },
  { id: 'team', name: 'Team' },
  { id: 'media', name: 'Media' },
  { id: 'design', name: 'Design' },
  { id: 'automation', name: 'Automation' },
  { id: 'ai', name: 'AI' },
];

const A = (id, name, category, auth, more = {}) => ({ id, name, category, auth, ...more });

const APPS = [
  // Money
  A('stripe', 'Stripe', 'money', 'key', { anchor: 'stripe', reads: 'Charges, payouts, invoices and products', writes: 'Products, prices, payment links and invoices you approve' }),
  A('square', 'Square', 'money', 'oauth', { provider: 'square', reads: 'Payments, totals only', writes: null }),
  A('paypal', 'PayPal', 'money', 'oauth', { provider: 'paypal', reads: 'Transactions, totals only', writes: null, ai: false, keepHours: 48 }),
  A('quickbooks', 'QuickBooks', 'money', 'oauth', { provider: 'quickbooks', reads: 'Profit and loss, invoices', writes: 'Draft invoices', waits: 'Legal is reading Intuit\'s developer terms first.' }),
  A('xero', 'Xero', 'money', 'oauth', { provider: 'xero', reads: 'Profit and loss, invoices', writes: 'Draft invoices' }),
  // Store
  A('shopify', 'Shopify', 'store', 'key', { anchor: 'shopify', reads: 'Store, products, orders (totals, no customers)', writes: 'Draft products' }),
  A('etsy', 'Etsy', 'store', 'oauth', { provider: 'etsy', reads: 'Listings and orders, totals only', writes: null, waits: 'Etsy\'s terms need its written OK first.' }),
  A('gumroad', 'Gumroad', 'store', 'oauth', { provider: 'gumroad', reads: 'Products and sales, totals only', writes: null }),
  A('woocommerce', 'WooCommerce', 'store', 'link', { reads: 'Orders, through the 127 link', writes: null }),
  // Email and CRM
  A('gmail', 'Gmail', 'email', 'oauth', { provider: 'google', scopes: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.compose'], reads: 'Threads you pick', writes: 'Drafts in your Gmail', waits: 'For email, use Make Claude your admin: your own Claude works in your Gmail.' }),
  A('klaviyo', 'Klaviyo', 'email', 'key', { reads: 'Lists and their sizes', writes: 'Draft campaigns' }),
  A('mailchimp', 'Mailchimp', 'email', 'key', { reads: 'Audiences and their sizes', writes: 'Draft campaigns' }),
  A('kit', 'Kit', 'email', 'key', { reads: 'Subscriber count and broadcasts', writes: 'Draft broadcasts' }),
  A('beehiiv', 'beehiiv', 'email', 'key', { reads: 'Publications and subscriber counts', writes: null }),
  A('hubspot', 'HubSpot', 'email', 'oauth', { provider: 'hubspot', reads: 'Contacts and deals, counts only', writes: 'Notes on a deal' }),
  A('airtable', 'Airtable', 'email', 'oauth', { provider: 'airtable', scopes: ['data.records:read', 'data.records:write', 'schema.bases:read'], reads: 'Bases and records you pick', writes: 'New records' }),
  // Calendar
  A('gcal', 'Google Calendar', 'calendar', 'oauth', { provider: 'google', scopes: ['https://www.googleapis.com/auth/calendar.readonly'], reads: 'Your events', writes: null, keepHours: 24 }),
  A('calendly', 'Calendly', 'calendar', 'key', { reads: 'Upcoming bookings', writes: null, ai: false, keepHours: 24 }),
  A('calcom', 'Cal.com', 'calendar', 'oauth', { provider: 'calcom', reads: 'Upcoming bookings', writes: null, keepHours: 24 }),
  // Social
  A('instagram', 'Instagram', 'social', 'oauth', { provider: 'meta', scopes: ['instagram_business_basic', 'instagram_business_manage_insights'], reads: 'Posts and their reach', writes: null }),
  A('facebook', 'Facebook', 'social', 'oauth', { provider: 'meta', scopes: ['pages_show_list', 'pages_read_engagement', 'read_insights'], reads: 'Page posts and their reach', writes: null }),
  A('tiktok', 'TikTok', 'social', 'oauth', { provider: 'tiktok', scopes: ['user.info.basic', 'video.list'], reads: 'Videos and their views', writes: null }),
  A('youtube', 'YouTube', 'social', 'oauth', { provider: 'google', scopes: ['https://www.googleapis.com/auth/youtube.readonly'], reads: 'Videos and their views', writes: null, keepHours: 720 }),
  A('linkedin', 'LinkedIn', 'social', 'oauth', { provider: 'linkedin', scopes: ['openid', 'profile'], reads: 'Your profile', writes: null, ai: false, keepHours: 0 }),
  A('pinterest', 'Pinterest', 'social', 'oauth', { provider: 'pinterest', scopes: ['boards:read', 'pins:read'], reads: 'Pins and their views', writes: null, ai: false }),
  // Ads
  A('meta_ads', 'Meta Ads', 'ads', 'oauth', { provider: 'meta', scopes: ['ads_read', 'ads_management'], reads: 'Spend and results by ad', writes: 'Paused draft campaigns' }),
  A('google_ads', 'Google Ads', 'ads', 'oauth', { provider: 'google', scopes: ['https://www.googleapis.com/auth/adwords'], reads: 'Spend and results by campaign', writes: 'Paused draft campaigns' }),
  A('tiktok_ads', 'TikTok Ads', 'ads', 'oauth', { provider: 'tiktok_ads', reads: 'Spend and results by ad', writes: 'Paused draft campaigns', waits: 'The ads desk makes TikTok campaigns as upload files for now, while Legal reads TikTok\'s developer terms.' }),
  // Knowledge
  A('notion', 'Notion', 'knowledge', 'key', { reads: 'Pages you share with 127', writes: 'New pages with your results' }),
  A('obsidian', 'Obsidian', 'knowledge', 'file', { reads: 'A vault you upload as a .zip, in Brain', writes: null, href: '/app/hq/brain' }),
  A('gdrive', 'Google Drive', 'knowledge', 'oauth', { provider: 'google', scopes: ['https://www.googleapis.com/auth/drive.file'], reads: 'Files you pick', writes: 'Files 127 makes for you' }),
  A('dropbox', 'Dropbox', 'knowledge', 'oauth', { provider: 'dropbox', reads: 'Files you pick', writes: 'Files 127 makes for you' }),
  // Team
  A('slack', 'Slack', 'team', 'oauth', { provider: 'slack', scopes: ['chat:write', 'channels:read'], reads: 'Channel names', writes: 'Your daily report in one channel' }),
  A('discord', 'Discord', 'team', 'oauth', { provider: 'discord', scopes: ['identify', 'guilds'], reads: 'Your servers', writes: null }),
  // Media
// Studio providers through the member's own account (Legal L76 row 8, way 2): their key, their plan.
  A('higgsfield', 'Higgsfield', 'media', 'key', { media: true, reads: null, writes: 'Videos and images Studio makes on your account' }),
  A('fal', 'fal', 'media', 'key', { media: true, reads: null, writes: 'Images and videos Studio makes on your account' }),
  A('runway', 'Runway', 'media', 'key', { media: true, reads: null, writes: 'Videos Studio makes on your account', attribution: { text: 'Powered by Runway', href: 'https://runwayml.com' } }),
  A('luma', 'Luma', 'media', 'key', { media: true, reads: null, writes: 'Videos Studio makes on your account' }),
  A('elevenlabs', 'ElevenLabs', 'media', 'key', { media: true, reads: null, writes: 'Voiceovers and transcripts Studio makes on your account' }),
  A('google_gemini', 'Google Gemini', 'media', 'key', { media: true, reads: null, writes: 'Images and videos Studio makes on your account' }),
  // Design
  A('canva', 'Canva', 'design', 'oauth', { provider: 'canva', scopes: ['design:meta:read', 'design:content:write', 'asset:write'], reads: 'Your designs', writes: 'New designs from your results', waits: 'Canva\'s terms need its written OK first.' }),
  A('figma', 'Figma', 'design', 'oauth', { provider: 'figma', scopes: ['file_content:read'], reads: 'Files you open', writes: null }),
  // Automation
  A('zapier', 'Zapier', 'automation', 'link', { reads: 'Numbers sent to your 127 link', writes: null }),
  A('make', 'Make', 'automation', 'link', { reads: 'Numbers sent to your 127 link', writes: null }),
  A('n8n', 'n8n', 'automation', 'link', { reads: 'Numbers sent to your 127 link', writes: null }),
  A('netlify', 'Netlify', 'automation', 'oauth', { provider: 'netlify', reads: 'Your sites', writes: 'Publish a site you approve' }),
  // AI
  A('claude', 'Claude', 'ai', 'ai', { reads: '127 inside Claude, through your AI link', writes: null }),
  A('chatgpt', 'ChatGPT', 'ai', 'ai', { reads: '127 inside ChatGPT, through your AI link', writes: null }),
];

const byId = Object.fromEntries(APPS.map((a) => [a.id, a]));

module.exports = { CATEGORIES, APPS, byId };
