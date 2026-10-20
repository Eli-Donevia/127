// The connectors a member sets up by pasting a key or token: how to get one, how 127 checks it, and
// what packs can do with it (client). Reads return totals and the member's own content, never their
// customers' names, emails or addresses. Writes make drafts only, and only from an `act` step the
// member approved (index.js hands write() the approval; it refuses without one).
//
// API versions and endpoints are from each provider's docs (Oct 2026). A provider that answers 401
// or 403 marks the connection broken, and the member reconnects.

const SHOPIFY_API = '2025-10';
const NOTION_VERSION = '2022-06-28';
const KLAVIYO_REVISION = '2025-07-15';

class AppError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status || 0;
    this.auth = status === 401 || status === 403;
  }
}

// http({ url, method, headers, body }) -> parsed JSON. Errors never carry the key or the response body.
function makeHttp(fetchFn, { timeoutMs = 20000 } = {}) {
  return async function http(name, { url, method = 'GET', headers = {}, body, form } = {}) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    let res;
    try {
      const h = { accept: 'application/json', ...headers };
      let payload;
      if (form) {
        payload = new URLSearchParams(form).toString();
        h['content-type'] = 'application/x-www-form-urlencoded';
      } else if (body !== undefined) {
        payload = JSON.stringify(body);
        h['content-type'] = h['content-type'] || 'application/json';
      }
      res = await fetchFn(url, { method, headers: h, body: payload, signal: ac.signal, redirect: 'error' });
    } catch {
      throw new AppError(`${name} didn't answer. Try again in a minute.`, 0);
    } finally {
      clearTimeout(t);
    }
    if (res.status === 401 || res.status === 403) throw new AppError(`${name} didn't accept that key. Check you copied all of it and gave it the access listed.`, res.status);
    if (res.status === 404) throw new AppError(`${name} couldn't find that. Check the address or ID.`, 404);
    if (res.status === 429) throw new AppError(`${name} asked 127 to slow down. Try again in a few minutes.`, 429);
    if (!res.ok) throw new AppError(`${name} answered with an error (${res.status}). Try again in a minute.`, res.status);
    if (res.status === 204) return {};
    try {
      return await res.json();
    } catch {
      throw new AppError(`${name} sent something 127 couldn't read.`, res.status);
    }
  };
}

const clip = (s, n = 200) => {
  const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
const days = (n) => new Date(Date.now() - n * 864e5).toISOString();
const money = (v) => Math.round(Number(v || 0) * 100) / 100;

// ---------- Shopify (Admin API: a custom app's token, or a Dev Dashboard app's client credentials) ----------

const SHOP = /^[a-z0-9][a-z0-9-]{0,60}\.myshopify\.com$/;
function shopHost(raw) {
  const s = String(raw || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const host = s.includes('.') ? s : `${s}.myshopify.com`;
  return SHOP.test(host) ? host : null;
}

async function shopifyToken(creds, http) {
  if (creds.token) return creds.token;
  // Client credentials: tokens last 24 hours, so each use asks for a fresh one.
  const out = await http('Shopify', { url: `https://${creds.shop}/admin/oauth/access_token`, method: 'POST', form: { grant_type: 'client_credentials', client_id: creds.clientId, client_secret: creds.clientSecret } });
  if (!out.access_token) throw new AppError("Shopify didn't hand over a token. Check the app is installed on your store.", 401);
  return out.access_token;
}

const shopify = {
  id: 'shopify',
  name: 'Shopify',
  fields: [
    { name: 'shop', label: 'Store address', placeholder: 'your-store.myshopify.com' },
    { name: 'token', label: 'Admin API access token', placeholder: 'shpat_...', secret: true, optional: true },
    { name: 'clientId', label: 'Or: Client ID', optional: true },
    { name: 'clientSecret', label: 'and Client secret', secret: true, optional: true },
  ],
  steps: [
    'In Shopify admin, go to <strong>Settings</strong>, <strong>Apps</strong>, then <strong>Develop apps</strong> (newer stores: <strong>Build apps in Dev Dashboard</strong>).',
    'Create an app named 127 HQ. Give it <strong>read_products</strong>, <strong>read_orders</strong> and <strong>write_products</strong> (for drafts), then install it on your store.',
    'Paste the <strong>Admin API access token</strong> (starts with shpat_). From Dev Dashboard, paste the <strong>Client ID</strong> and <strong>Client secret</strong> instead.',
  ],
  parse(body) {
    const shop = shopHost(body.shop);
    if (!shop) return { error: 'Use your store address, like your-store.myshopify.com.' };
    const token = String(body.token || '').trim();
    const clientId = String(body.clientId || '').trim();
    const clientSecret = String(body.clientSecret || '').trim();
    if (token) {
      if (!/^shp(at|ca|pa)_[A-Za-z0-9]{20,}$/.test(token)) return { error: "That doesn't look like an Admin API token. It starts with shpat_." };
      return { creds: { shop, token } };
    }
    if (clientId && clientSecret) return { creds: { shop, clientId, clientSecret } };
    return { error: 'Paste the Admin API access token, or the Client ID and Client secret.' };
  },
  async test(creds, http) {
    const token = await shopifyToken(creds, http);
    const out = await http('Shopify', { url: `https://${creds.shop}/admin/api/${SHOPIFY_API}/shop.json`, headers: { 'x-shopify-access-token': token } });
    return { label: clip((out.shop && out.shop.name) || creds.shop, 80) };
  },
  client(creds, http) {
    const api = async (path, opts = {}) => {
      const token = await shopifyToken(creds, http);
      return http('Shopify', { url: `https://${creds.shop}/admin/api/${SHOPIFY_API}${path}`, ...opts, headers: { 'x-shopify-access-token': token } });
    };
    return {
      async shop() {
        const s = (await api('/shop.json')).shop || {};
        return { name: s.name, domain: s.domain, currency: s.currency, plan: s.plan_display_name, country: s.country_code };
      },
      async products({ limit = 50 } = {}) {
        const out = await api(`/products.json?limit=${Math.min(250, Math.max(1, limit))}&fields=id,title,status,product_type,vendor,tags,variants,created_at`);
        return (out.products || []).map((p) => ({
          id: String(p.id), title: p.title, status: p.status, type: p.product_type, vendor: p.vendor, tags: p.tags,
          variants: (p.variants || []).map((v) => ({ title: v.title, price: money(v.price), compareAt: v.compare_at_price ? money(v.compare_at_price) : null, sku: v.sku, inventory: v.inventory_quantity })),
        }));
      },
      // Orders as totals and line items only: no customer, address, email or note fields are requested.
      async orders({ sinceDays = 30, limit = 250 } = {}) {
        const fields = 'id,created_at,total_price,subtotal_price,total_discounts,currency,financial_status,cancelled_at,line_items,source_name';
        const out = await api(`/orders.json?status=any&limit=${Math.min(250, Math.max(1, limit))}&created_at_min=${encodeURIComponent(days(sinceDays))}&fields=${fields}`);
        return (out.orders || []).map((o) => ({
          id: String(o.id), at: o.created_at, total: money(o.total_price), subtotal: money(o.subtotal_price), discounts: money(o.total_discounts), currency: o.currency,
          paid: o.financial_status, cancelled: !!o.cancelled_at, channel: o.source_name,
          items: (o.line_items || []).map((l) => ({ title: l.title, quantity: l.quantity, price: money(l.price) })),
        }));
      },
      writes: {
        // A product as a draft: never published to the store by 127.
        async draftProduct({ title, body, price, type, tags }) {
          const out = await api('/products.json', { method: 'POST', body: { product: { title: clip(title, 255), body_html: String(body || ''), product_type: type || '', tags: tags || '', status: 'draft', variants: price ? [{ price: String(price) }] : undefined } } });
          return { id: String(out.product.id), title: out.product.title, status: out.product.status, url: `https://${creds.shop}/admin/products/${out.product.id}` };
        },
      },
    };
  },
};

// ---------- Notion (internal integration token) ----------

const notionHeaders = (creds) => ({ authorization: `Bearer ${creds.token}`, 'notion-version': NOTION_VERSION });
function notionText(rich) {
  return (rich || []).map((r) => r.plain_text || '').join('');
}
function notionTitle(page) {
  const props = page.properties || {};
  for (const p of Object.values(props)) if (p.type === 'title') return notionText(p.title);
  return notionText(page.title) || 'Untitled';
}
const notion = {
  id: 'notion',
  name: 'Notion',
  fields: [{ name: 'token', label: 'Internal integration secret', placeholder: 'ntn_...', secret: true }],
  steps: [
    'Go to <strong>notion.so/profile/integrations</strong> and create a new <strong>internal</strong> integration named 127 HQ.',
    'Give it <strong>Read content</strong> and <strong>Insert content</strong>. Copy the <strong>Internal integration secret</strong>.',
    'In Notion, open each page 127 should see, choose <strong>…</strong>, <strong>Connections</strong>, and add 127 HQ. 127 sees only those pages.',
  ],
  parse(body) {
    const token = String(body.token || '').trim();
    if (!/^(ntn_|secret_)[A-Za-z0-9]{20,}$/.test(token)) return { error: "That doesn't look like a Notion secret. It starts with ntn_." };
    return { creds: { token } };
  },
  async test(creds, http) {
    const me = await http('Notion', { url: 'https://api.notion.com/v1/users/me', headers: notionHeaders(creds) });
    return { label: clip((me.bot && me.bot.workspace_name) || me.name || 'Notion', 80) };
  },
  client(creds, http) {
    const api = (path, opts = {}) => http('Notion', { url: `https://api.notion.com/v1${path}`, ...opts, headers: notionHeaders(creds) });
    return {
      async pages({ query = '', limit = 25 } = {}) {
        const out = await api('/search', { method: 'POST', body: { query: String(query).slice(0, 200), filter: { property: 'object', value: 'page' }, page_size: Math.min(100, Math.max(1, limit)) } });
        return (out.results || []).map((p) => ({ id: p.id, title: notionTitle(p), url: p.url, edited: p.last_edited_time }));
      },
      // One page as plain text, top-level blocks only, up to maxChars.
      async read(pageId, { maxChars = 40000 } = {}) {
        const id = String(pageId || '').replace(/[^a-f0-9-]/gi, '');
        if (!id) throw new AppError('Pick a Notion page.', 400);
        const page = await api(`/pages/${id}`);
        const lines = [];
        let cursor;
        let size = 0;
        do {
          const out = await api(`/blocks/${id}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`);
          for (const b of out.results || []) {
            const v = b[b.type] || {};
            const t = notionText(v.rich_text);
            if (!t) continue;
            const line = b.type.startsWith('heading') ? `${'#'.repeat(Number(b.type.slice(-1)) || 1)} ${t}` : b.type.includes('list_item') ? `- ${t}` : b.type === 'to_do' ? `- [${v.checked ? 'x' : ' '}] ${t}` : t;
            lines.push(line);
            size += line.length;
          }
          cursor = out.has_more ? out.next_cursor : null;
        } while (cursor && size < maxChars);
        return { id, title: notionTitle(page), url: page.url, text: lines.join('\n\n').slice(0, maxChars) };
      },
      writes: {
        // A new page under a page the member shared with 127: a run's result, as paragraphs.
        async createPage({ parentId, title, text }) {
          const blocks = String(text || '').split(/\n{2,}/).filter(Boolean).slice(0, 100).map((p) => ({ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: p.slice(0, 2000) } }] } }));
          const out = await api('/pages', { method: 'POST', body: { parent: { page_id: String(parentId) }, properties: { title: { title: [{ text: { content: clip(title, 200) } }] } }, children: blocks } });
          return { id: out.id, url: out.url };
        },
      },
    };
  },
};

// ---------- Airtable (personal access token) ----------

// Signs in (oauth.js), because Airtable's developer terms bar apps from using a member's pasted token
// (Legal K8). The client takes the fresh access token index.js gets for each call.
const airtable = {
  id: 'airtable',
  name: 'Airtable',
  client(creds, http) {
    const h = { authorization: `Bearer ${creds.token}` };
    const safe = (s) => encodeURIComponent(String(s || '').slice(0, 120));
    return {
      async bases() {
        const out = await http('Airtable', { url: 'https://api.airtable.com/v0/meta/bases', headers: h });
        return (out.bases || []).map((b) => ({ id: b.id, name: b.name }));
      },
      async records(baseId, table, { limit = 100 } = {}) {
        const out = await http('Airtable', { url: `https://api.airtable.com/v0/${safe(baseId)}/${safe(table)}?pageSize=${Math.min(100, Math.max(1, limit))}`, headers: h });
        return (out.records || []).map((r) => ({ id: r.id, fields: r.fields }));
      },
      writes: {
        async addRecord({ baseId, table, fields }) {
          const out = await http('Airtable', { url: `https://api.airtable.com/v0/${safe(baseId)}/${safe(table)}`, method: 'POST', headers: h, body: { records: [{ fields }] } });
          return { id: out.records && out.records[0] && out.records[0].id };
        },
      },
    };
  },
};

// ---------- Klaviyo (private API key) ----------

const klaviyoHeaders = (creds) => ({ authorization: `Klaviyo-API-Key ${creds.key}`, revision: KLAVIYO_REVISION, accept: 'application/vnd.api+json' });
const klaviyo = {
  id: 'klaviyo',
  name: 'Klaviyo',
  fields: [{ name: 'key', label: 'Private API key', placeholder: 'pk_...', secret: true }],
  steps: [
    'In Klaviyo, go to <strong>Settings</strong>, <strong>Account</strong>, <strong>API keys</strong>, and choose <strong>Create Private API Key</strong>.',
    'Name it 127 HQ. Choose <strong>Custom</strong>: <strong>Lists</strong> Read, <strong>Campaigns</strong> Full (for drafts), <strong>Templates</strong> Full. Leave the rest at No access.',
    'Copy the key (starts with pk_) and paste it below.',
  ],
  parse(body) {
    const key = String(body.key || '').trim();
    if (!/^pk_[A-Za-z0-9]{20,}$/.test(key)) return { error: "That doesn't look like a private key. It starts with pk_." };
    return { creds: { key } };
  },
  async test(creds, http) {
    const out = await http('Klaviyo', { url: 'https://a.klaviyo.com/api/accounts/', headers: klaviyoHeaders(creds) });
    const a = (out.data && out.data[0] && out.data[0].attributes) || {};
    return { label: clip((a.contact_information && a.contact_information.organization_name) || 'Klaviyo', 80) };
  },
  client(creds, http) {
    const api = (path, opts = {}) => http('Klaviyo', { url: `https://a.klaviyo.com/api${path}`, ...opts, headers: { ...klaviyoHeaders(creds), ...(opts.body ? { 'content-type': 'application/vnd.api+json' } : {}) } });
    return {
      async lists() {
        const out = await api('/lists/?additional-fields[list]=profile_count');
        return (out.data || []).map((l) => ({ id: l.id, name: l.attributes.name, size: l.attributes.profile_count == null ? null : l.attributes.profile_count }));
      },
      writes: {
        // A draft campaign to one list: Klaviyo keeps it in Drafts until the member sends it there.
        async draftCampaign({ name, listId, subject, previewText, html }) {
          const tpl = await api('/templates/', { method: 'POST', body: { data: { type: 'template', attributes: { name: clip(`${name} (127)`, 120), editor_type: 'CODE', html: String(html || '') } } } });
          const out = await api('/campaigns/', {
            method: 'POST',
            body: { data: { type: 'campaign', attributes: { name: clip(name, 120), audiences: { included: [String(listId)] }, 'campaign-messages': { data: [{ type: 'campaign-message', attributes: { channel: 'email', label: clip(name, 120), content: { subject: clip(subject, 150), preview_text: clip(previewText || '', 150) } } }] } } } },
          });
          const msg = out.data && out.data.relationships && out.data.relationships['campaign-messages'] && out.data.relationships['campaign-messages'].data[0];
          if (msg && tpl.data) await api('/campaign-message-assign-template/', { method: 'POST', body: { data: { type: 'campaign-message', id: msg.id, relationships: { template: { data: { type: 'template', id: tpl.data.id } } } } } });
          return { id: out.data.id, url: `https://www.klaviyo.com/campaign/${out.data.id}/edit` };
        },
      },
    };
  },
};

// ---------- Mailchimp (API key with its data center suffix) ----------

const mailchimpBase = (creds) => `https://${creds.dc}.api.mailchimp.com/3.0`;
const mailchimpAuth = (creds) => ({ authorization: `Basic ${Buffer.from(`127:${creds.key}`).toString('base64')}` });
const mailchimp = {
  id: 'mailchimp',
  name: 'Mailchimp',
  fields: [{ name: 'key', label: 'API key', placeholder: '…-us21', secret: true }],
  steps: [
    'In Mailchimp, open your profile, then <strong>Extras</strong>, <strong>API keys</strong>, and choose <strong>Create A Key</strong>.',
    'Name it 127 HQ and copy it. It ends in something like -us21.',
  ],
  parse(body) {
    const key = String(body.key || '').trim();
    const m = /^[a-f0-9]{32}-(us\d{1,3})$/.exec(key);
    if (!m) return { error: "That doesn't look like a Mailchimp key. It ends in -us and a number." };
    return { creds: { key, dc: m[1] } };
  },
  async test(creds, http) {
    await http('Mailchimp', { url: `${mailchimpBase(creds)}/ping`, headers: mailchimpAuth(creds) });
    const me = await http('Mailchimp', { url: `${mailchimpBase(creds)}/?fields=account_name`, headers: mailchimpAuth(creds) });
    return { label: clip(me.account_name || 'Mailchimp', 80) };
  },
  client(creds, http) {
    const api = (path, opts = {}) => http('Mailchimp', { url: `${mailchimpBase(creds)}${path}`, ...opts, headers: mailchimpAuth(creds) });
    return {
      async lists() {
        const out = await api('/lists?count=50&fields=lists.id,lists.name,lists.stats.member_count,lists.stats.open_rate,lists.stats.click_rate');
        return (out.lists || []).map((l) => ({ id: l.id, name: l.name, size: l.stats.member_count, openRate: l.stats.open_rate, clickRate: l.stats.click_rate }));
      },
      writes: {
        // A regular campaign left in Drafts; 127 never calls send.
        async draftCampaign({ name, listId, subject, previewText, fromName, replyTo, html }) {
          const out = await api('/campaigns', { method: 'POST', body: { type: 'regular', recipients: { list_id: String(listId) }, settings: { title: clip(name, 100), subject_line: clip(subject, 150), preview_text: clip(previewText || '', 150), from_name: clip(fromName || '', 100), reply_to: String(replyTo || '') } } });
          await api(`/campaigns/${out.id}/content`, { method: 'PUT', body: { html: String(html || '') } });
          return { id: out.id, url: out.web_id ? `https://${creds.dc}.admin.mailchimp.com/campaigns/edit?id=${out.web_id}` : null };
        },
      },
    };
  },
};

// ---------- Kit (v4 API key) ----------

const kit = {
  id: 'kit',
  name: 'Kit',
  fields: [{ name: 'key', label: 'V4 API key', placeholder: 'kit_...', secret: true }],
  steps: ['In Kit, go to <strong>Settings</strong>, <strong>Developer</strong>, and choose <strong>Add a new key</strong> under V4 API keys.', 'Name it 127 HQ, copy it and paste it below.'],
  parse(body) {
    const key = String(body.key || '').trim();
    if (!/^kit_[A-Za-z0-9]{20,}$/.test(key)) return { error: "That doesn't look like a Kit V4 key. It starts with kit_." };
    return { creds: { key } };
  },
  async test(creds, http) {
    const out = await http('Kit', { url: 'https://api.kit.com/v4/account', headers: { 'x-kit-api-key': creds.key } });
    return { label: clip((out.account && out.account.name) || 'Kit', 80) };
  },
  client(creds, http) {
    const api = (path, opts = {}) => http('Kit', { url: `https://api.kit.com/v4${path}`, ...opts, headers: { 'x-kit-api-key': creds.key } });
    return {
      async stats() {
        const out = await api('/subscribers?per_page=1&include_total_count=true');
        return { subscribers: out.pagination && out.pagination.total_count != null ? out.pagination.total_count : null };
      },
      async broadcasts({ limit = 20 } = {}) {
        const out = await api(`/broadcasts?per_page=${Math.min(100, Math.max(1, limit))}`);
        return (out.broadcasts || []).map((b) => ({ id: String(b.id), subject: b.subject, sentAt: b.send_at || null, public: !!b.public }));
      },
      writes: {
        // No send_at: Kit keeps it as a draft.
        async draftBroadcast({ subject, previewText, html }) {
          const out = await api('/broadcasts', { method: 'POST', body: { subject: clip(subject, 150), preview_text: clip(previewText || '', 150), content: String(html || ''), public: false, send_at: null } });
          return { id: String(out.broadcast.id), url: `https://app.kit.com/campaigns/${out.broadcast.id}/draft` };
        },
      },
    };
  },
};

// ---------- beehiiv (API key) ----------

const beehiiv = {
  id: 'beehiiv',
  name: 'beehiiv',
  fields: [{ name: 'key', label: 'API key', secret: true }],
  steps: ['In beehiiv, go to <strong>Settings</strong>, <strong>Workspace settings</strong>, <strong>API</strong>, and choose <strong>Create new API key</strong>.', 'Name it 127 HQ, copy it and paste it below.'],
  parse(body) {
    const key = String(body.key || '').trim();
    if (!/^[A-Za-z0-9]{32,128}$/.test(key)) return { error: "That doesn't look like a beehiiv key." };
    return { creds: { key } };
  },
  async test(creds, http) {
    const out = await http('beehiiv', { url: 'https://api.beehiiv.com/v2/publications?limit=1', headers: { authorization: `Bearer ${creds.key}` } });
    return { label: clip((out.data && out.data[0] && out.data[0].name) || 'beehiiv', 80) };
  },
  client(creds, http) {
    return {
      async publications() {
        const out = await http('beehiiv', { url: 'https://api.beehiiv.com/v2/publications?expand[]=stats', headers: { authorization: `Bearer ${creds.key}` } });
        return (out.data || []).map((p) => ({ id: p.id, name: p.name, subscribers: p.stats ? p.stats.active_subscriptions : null, openRate: p.stats ? p.stats.average_open_rate : null, clickRate: p.stats ? p.stats.average_click_rate : null }));
      },
      // Creating posts through beehiiv's API is for its Enterprise plan, so 127 writes none here.
      writes: {},
    };
  },
};

// ---------- Calendly (personal access token) ----------

const calendly = {
  id: 'calendly',
  name: 'Calendly',
  fields: [{ name: 'token', label: 'Personal access token', secret: true }],
  steps: ['In Calendly, go to <strong>Integrations</strong>, <strong>API and webhooks</strong>, and choose <strong>Generate new token</strong>.', 'Name it 127 HQ, copy it and paste it below.'],
  parse(body) {
    const token = String(body.token || '').trim();
    if (!/^[A-Za-z0-9._-]{40,}$/.test(token)) return { error: "That doesn't look like a Calendly token." };
    return { creds: { token } };
  },
  async test(creds, http) {
    const me = await http('Calendly', { url: 'https://api.calendly.com/users/me', headers: { authorization: `Bearer ${creds.token}` } });
    return { label: clip((me.resource && me.resource.name) || 'Calendly', 80), extra: { user: me.resource && me.resource.uri } };
  },
  client(creds, http) {
    const h = { authorization: `Bearer ${creds.token}` };
    return {
      // Upcoming bookings: when and which event type. Invitee names and emails are not requested.
      async bookings({ daysAhead = 14 } = {}) {
        const me = creds.user || ((await http('Calendly', { url: 'https://api.calendly.com/users/me', headers: h })).resource || {}).uri;
        const max = new Date(Date.now() + daysAhead * 864e5).toISOString();
        const out = await http('Calendly', { url: `https://api.calendly.com/scheduled_events?user=${encodeURIComponent(me)}&status=active&min_start_time=${encodeURIComponent(new Date().toISOString())}&max_start_time=${encodeURIComponent(max)}&count=100`, headers: h });
        return (out.collection || []).map((e) => ({ name: e.name, start: e.start_time, end: e.end_time }));
      },
      writes: {},
    };
  },
};

// ---------- Stripe for workflows (a restricted key; HQ v1's Charges-read key works for charges) ----------

const STRIPE_NEEDS = { charges: 'Charges', balance_transactions: 'Balance', payouts: 'Payouts', invoices: 'Invoices', products: 'Products', prices: 'Prices', payment_links: 'Payment Links', customers: 'Customers' };
function stripeWrap(err, what, write) {
  if (err && (err.statusCode === 401 || err.type === 'StripeAuthenticationError')) return new AppError("Stripe didn't accept the saved key. Reconnect Stripe.", 401);
  if (err && (err.statusCode === 403 || err.type === 'StripePermissionError')) return new AppError(`Your Stripe key can't ${write ? 'change' : 'read'} ${STRIPE_NEEDS[what] || what}. Edit it in Stripe and set ${STRIPE_NEEDS[what] || what} to ${write ? 'Write' : 'Read'}.`, 403);
  if (err && err.statusCode === 400) return new AppError(`Stripe said no: ${clip(err.message || 'check the details', 160)}`, 400);
  return new AppError("Stripe didn't answer. Try again in a minute.", (err && err.statusCode) || 0);
}
const cents = (amount, currency) => (ZERO_DECIMAL.has(String(currency || 'usd').toLowerCase()) ? Math.round(Number(amount)) : Math.round(Number(amount) * 100));
const units = (amount, currency) => (ZERO_DECIMAL.has(String(currency || 'usd').toLowerCase()) ? amount : amount / 100);
const ZERO_DECIMAL = new Set(['bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf']);

const stripe = {
  id: 'stripe',
  name: 'Stripe',
  fields: [{ name: 'key', label: 'Restricted key', placeholder: 'rk_live_...', secret: true }],
  steps: [
    'In Stripe, go to <strong>API keys</strong> and choose <strong>Create restricted key</strong>. Name it 127 workflows.',
    'Read: <strong>Charges</strong>, <strong>Balance</strong>, <strong>Payouts</strong>, <strong>Invoices</strong>, <strong>Products</strong>, <strong>Prices</strong>. Write (for invoices and payment links you approve): <strong>Products</strong>, <strong>Prices</strong>, <strong>Payment Links</strong>, <strong>Customers</strong>, <strong>Invoices</strong>.',
    'Copy the key (starts with rk_) and paste it below. Your HQ numbers keep using the key on the Stripe card.',
  ],
  parse(body) {
    const key = String(body.key || '').trim();
    if (/^sk_/.test(key)) return { error: "That's a secret key, which can do anything in your Stripe account. Make a restricted key instead." };
    if (!/^rk_(live|test)_[A-Za-z0-9]{20,}$/.test(key)) return { error: "That doesn't look like a restricted key. It starts with rk_live_ or rk_test_." };
    return { creds: { key } };
  },
  async test(creds, _http, { stripe: makeStripe }) {
    try {
      await makeStripe(creds.key).charges.list({ limit: 1 });
    } catch (err) {
      throw stripeWrap(err, 'charges');
    }
    return { label: `rk_${creds.key.startsWith('rk_live_') ? 'live' : 'test'}_••••${creds.key.slice(-4)}` };
  },
  client(creds, _http, { stripe: makeStripe }) {
    const s = makeStripe(creds.key);
    const since = (d) => ({ gte: Math.floor((Date.now() - Math.max(1, Math.min(730, Number(d) || 30)) * 864e5) / 1000) });
    const each = async (what, list, map, limit = 1000) => {
      const out = [];
      try {
        for await (const x of list) {
          out.push(map(x));
          if (out.length >= limit) break;
        }
      } catch (err) {
        throw stripeWrap(err, what);
      }
      return out;
    };
    const w = async (what, fn) => {
      try {
        return await fn();
      } catch (err) {
        throw stripeWrap(err, what, true);
      }
    };
    const at = (t) => (t ? new Date(t * 1000).toISOString() : null);
    const inv = (i) => ({ id: i.id, number: i.number, status: i.status, total: units(i.total, i.currency), due: units(i.amount_remaining, i.currency), currency: i.currency, dueDate: at(i.due_date), created: at(i.created), overdue: i.status === 'open' && !!i.due_date && i.due_date * 1000 < Date.now(), customerName: i.customer_name || null, customerEmail: i.customer_email || null, url: i.hosted_invoice_url || null });
    return {
      // Charges as totals: no customer, email or card fields.
      charges: ({ sinceDays = 30, limit } = {}) => each('charges', s.charges.list({ created: since(sinceDays), limit: 100 }), (ch) => ({ id: ch.id, at: at(ch.created), amount: units(ch.amount, ch.currency), refunded: units(ch.amount_refunded || 0, ch.currency), currency: ch.currency, status: ch.status, paid: !!ch.paid, description: clip(ch.description || '', 120) }), limit),
      balanceTransactions: ({ sinceDays = 30, limit } = {}) => each('balance_transactions', s.balanceTransactions.list({ created: since(sinceDays), limit: 100 }), (b) => ({ id: b.id, at: at(b.created), type: b.type, amount: units(b.amount, b.currency), fee: units(b.fee, b.currency), net: units(b.net, b.currency), currency: b.currency, description: clip(b.description || '', 120) }), limit),
      payouts: ({ sinceDays = 90, limit } = {}) => each('payouts', s.payouts.list({ created: since(sinceDays), limit: 100 }), (p) => ({ id: p.id, arrival: at(p.arrival_date), amount: units(p.amount, p.currency), currency: p.currency, status: p.status }), limit),
      // Invoices name the customer and their email: chasing an overdue invoice needs them (LEGAL-ASKS).
      invoices: async ({ status = 'open', overdue = false, limit } = {}) => {
        const list = await each('invoices', s.invoices.list({ status, limit: 100 }), inv, limit);
        return overdue ? list.filter((i) => i.overdue) : list;
      },
      products: ({ limit } = {}) => each('products', s.products.list({ active: true, limit: 100 }), (p) => ({ id: p.id, name: p.name, description: clip(p.description || '', 300) }), limit),
      prices: ({ product, limit } = {}) => each('prices', s.prices.list({ active: true, limit: 100, ...(product ? { product: String(product) } : {}) }), (p) => ({ id: p.id, product: p.product, amount: p.unit_amount == null ? null : units(p.unit_amount, p.currency), currency: p.currency, interval: p.recurring ? p.recurring.interval : null }), limit),
      writes: {
        createProduct: ({ name, description }) => w('products', async () => {
          const p = await s.products.create({ name: clip(name, 250), ...(description ? { description: clip(description, 500) } : {}) });
          return { id: p.id, name: p.name };
        }),
        createPrice: ({ product, unitAmount, currency = 'usd', interval }) => w('prices', async () => {
          const p = await s.prices.create({ product: String(product), currency, unit_amount: cents(unitAmount, currency), ...(interval ? { recurring: { interval } } : {}) });
          return { id: p.id, amount: units(p.unit_amount, p.currency), currency: p.currency };
        }),
        createPaymentLink: ({ price, quantity = 1 }) => w('payment_links', async () => {
          const l = await s.paymentLinks.create({ line_items: [{ price: String(price), quantity: Math.max(1, Math.round(Number(quantity) || 1)) }] });
          return { id: l.id, url: l.url };
        }),
        createCustomer: ({ name, email }) => w('customers', async () => {
          const c = await s.customers.create({ name: clip(name, 200), email: String(email || '').trim() || undefined });
          return { id: c.id };
        }),
        // A draft invoice: nothing reaches the customer until finalize and send, each approved.
        createInvoice: ({ customer, items = [], daysUntilDue = 14, currency = 'usd' }) => w('invoices', async () => {
          const i = await s.invoices.create({ customer: String(customer), collection_method: 'send_invoice', days_until_due: Math.max(1, Math.min(90, Number(daysUntilDue) || 14)), auto_advance: false, currency });
          for (const it of items.slice(0, 50)) {
            await s.invoiceItems.create(it.price ? { customer: String(customer), invoice: i.id, price: String(it.price) } : { customer: String(customer), invoice: i.id, amount: cents(it.amount, currency), currency, description: clip(it.description || 'Item', 200) });
          }
          return inv(await s.invoices.retrieve(i.id));
        }),
        finalizeInvoice: (id) => w('invoices', async () => inv(await s.invoices.finalizeInvoice(String(id), { auto_advance: false }))),
        sendInvoice: (id) => w('invoices', async () => inv(await s.invoices.sendInvoice(String(id)))),
      },
    };
  },
};

const APPS = { stripe, shopify, notion, klaviyo, mailchimp, kit, beehiiv, calendly };
// Sign-in connectors with a client of their own (the rest hand packs a token).
const SIGNIN = { airtable };

module.exports = { APPS, SIGNIN, AppError, makeHttp, shopHost, SHOPIFY_API, NOTION_VERSION, KLAVIYO_REVISION };
