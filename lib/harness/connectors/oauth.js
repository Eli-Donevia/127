// "Sign in with" for the connectors that need 127's own app with the provider (BUILD-PLAN W1, W11).
// One flow for every provider: start() sends the member to the provider with a random state (kept in
// their session, with a PKCE verifier where the provider takes one), callback() swaps the code for
// tokens, and token() refreshes them before they run out.
//
// A provider is Coming until OAUTH_<PROVIDER>_ID and OAUTH_<PROVIDER>_SECRET are set (127's app there;
// v2/turnkey/SIGNUPS.md says where Eli makes each). The redirect address to register with the provider
// is <BASE_URL>/app/hq/connect/<provider>/callback.
//
// Endpoints are from each provider's docs (Oct 2026); confirm them when the app is made, since a few
// providers move them between API versions.

const crypto = require('crypto');

const META_V = 'v23.0';

// authUrl, tokenUrl; clientAuth: 'basic' (HTTP Basic) or 'body' (client_id and secret in the form);
// json: the token endpoint wants JSON; pkce: S256 challenge; sep: how scopes are joined; extra: more
// authorize parameters; idParam: the client id's name in the authorize URL.
const PROVIDERS = {
  google: { name: 'Google', authUrl: 'https://accounts.google.com/o/oauth2/v2/auth', tokenUrl: 'https://oauth2.googleapis.com/token', clientAuth: 'body', pkce: true, extra: { access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true' } },
  meta: { name: 'Meta', authUrl: `https://www.facebook.com/${META_V}/dialog/oauth`, tokenUrl: `https://graph.facebook.com/${META_V}/oauth/access_token`, clientAuth: 'body', sep: ',' },
  tiktok: { name: 'TikTok', authUrl: 'https://www.tiktok.com/v2/auth/authorize/', tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/', clientAuth: 'body', idParam: 'client_key', sep: ',', pkce: true },
  // TikTok For Business (ads) is its own app, with its own names for the id, secret and code.
  tiktok_ads: { name: 'TikTok For Business', authUrl: 'https://business-api.tiktok.com/portal/auth', tokenUrl: 'https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/', clientAuth: 'body', json: true, idParam: 'app_id', secretParam: 'secret', codeParam: 'auth_code', bare: true },
  linkedin: { name: 'LinkedIn', authUrl: 'https://www.linkedin.com/oauth/v2/authorization', tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken', clientAuth: 'body' },
  pinterest: { name: 'Pinterest', authUrl: 'https://www.pinterest.com/oauth/', tokenUrl: 'https://api.pinterest.com/v5/oauth/token', clientAuth: 'basic', sep: ',' },
  canva: { name: 'Canva', authUrl: 'https://www.canva.com/api/oauth/authorize', tokenUrl: 'https://api.canva.com/rest/v1/oauth/token', clientAuth: 'basic', pkce: true },
  figma: { name: 'Figma', authUrl: 'https://www.figma.com/oauth', tokenUrl: 'https://api.figma.com/v1/oauth/token', clientAuth: 'basic' },
  quickbooks: { name: 'QuickBooks', authUrl: 'https://appcenter.intuit.com/connect/oauth2', tokenUrl: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', clientAuth: 'basic', scopes: ['com.intuit.quickbooks.accounting'] },
  xero: { name: 'Xero', authUrl: 'https://login.xero.com/identity/connect/authorize', tokenUrl: 'https://identity.xero.com/connect/token', clientAuth: 'basic', scopes: ['offline_access', 'accounting.reports.read', 'accounting.transactions'] },
  square: { name: 'Square', authUrl: 'https://connect.squareup.com/oauth2/authorize', tokenUrl: 'https://connect.squareup.com/oauth2/token', clientAuth: 'body', json: true, scopes: ['PAYMENTS_READ', 'MERCHANT_PROFILE_READ'] },
  paypal: { name: 'PayPal', authUrl: 'https://www.paypal.com/signin/authorize', tokenUrl: 'https://api-m.paypal.com/v1/oauth2/token', clientAuth: 'basic', scopes: ['openid', 'https://uri.paypal.com/services/reporting/search/read'], extra: { flowEntry: 'static' } },
  gumroad: { name: 'Gumroad', authUrl: 'https://gumroad.com/oauth/authorize', tokenUrl: 'https://api.gumroad.com/oauth/token', clientAuth: 'body', scopes: ['view_sales'] },
  etsy: { name: 'Etsy', authUrl: 'https://www.etsy.com/oauth/connect', tokenUrl: 'https://api.etsy.com/v3/public/oauth/token', clientAuth: 'body', pkce: true, scopes: ['listings_r', 'transactions_r', 'shops_r'] },
  slack: { name: 'Slack', authUrl: 'https://slack.com/oauth/v2/authorize', tokenUrl: 'https://slack.com/api/oauth.v2.access', clientAuth: 'body', sep: ',' },
  discord: { name: 'Discord', authUrl: 'https://discord.com/oauth2/authorize', tokenUrl: 'https://discord.com/api/oauth2/token', clientAuth: 'body' },
  hubspot: { name: 'HubSpot', authUrl: 'https://app.hubspot.com/oauth/authorize', tokenUrl: 'https://api.hubapi.com/oauth/v1/token', clientAuth: 'body', scopes: ['crm.objects.contacts.read', 'crm.objects.deals.read'] },
  dropbox: { name: 'Dropbox', authUrl: 'https://www.dropbox.com/oauth2/authorize', tokenUrl: 'https://api.dropboxapi.com/oauth2/token', clientAuth: 'body', pkce: true, extra: { token_access_type: 'offline' }, scopes: ['files.content.read', 'files.content.write'] },
  calcom: { name: 'Cal.com', authUrl: 'https://app.cal.com/auth/oauth2/authorize', tokenUrl: 'https://app.cal.com/api/auth/oauth/token', clientAuth: 'body', json: true },
  netlify: { name: 'Netlify', authUrl: 'https://app.netlify.com/authorize', tokenUrl: 'https://api.netlify.com/oauth/token', clientAuth: 'body' },
};

const env = (k) => (process.env[k] ? String(process.env[k]).trim() : '');
const ENV = (provider) => provider.toUpperCase().replace(/[^A-Z0-9]/g, '_');

function known(provider) {
  return Object.prototype.hasOwnProperty.call(PROVIDERS, provider);
}
// 127's app with this provider: { id, secret } or null.
function client(provider) {
  if (!known(provider)) return null;
  const id = env(`OAUTH_${ENV(provider)}_ID`);
  const secret = env(`OAUTH_${ENV(provider)}_SECRET`);
  return id && secret ? { id, secret } : null;
}
function ready(provider) {
  return !!client(provider);
}
function redirectUri(base, provider) {
  return `${String(base || '').replace(/\/$/, '')}/app/hq/connect/${provider}/callback`;
}
const b64url = (buf) => Buffer.from(buf).toString('base64url');

// Where to send the member, and what to keep in their session until they come back.
function start(provider, { base, scopes = [], app }) {
  const p = PROVIDERS[provider];
  const c = client(provider);
  if (!p || !c) return null;
  const state = b64url(crypto.randomBytes(24));
  const verifier = p.pkce ? b64url(crypto.randomBytes(48)) : null;
  const all = [...new Set([...(p.scopes || []), ...scopes])];
  const q = new URLSearchParams({ [p.idParam || 'client_id']: c.id, redirect_uri: redirectUri(base, provider), state, ...(p.bare ? {} : { response_type: 'code' }), ...(p.extra || {}) });
  if (all.length && !p.bare) q.set('scope', all.join(p.sep || ' '));
  if (verifier) {
    q.set('code_challenge', b64url(crypto.createHash('sha256').update(verifier).digest()));
    q.set('code_challenge_method', 'S256');
  }
  return { url: `${p.authUrl}?${q.toString()}`, pending: { provider, app, state, verifier, scopes: all, at: Date.now() } };
}

const PENDING_MS = 15 * 60 * 1000;

// Checks the provider sent back the same state as the member's session holds, within 15 minutes.
function matches(pending, provider, state, now = Date.now()) {
  if (!pending || pending.provider !== provider || typeof state !== 'string' || !state) return false;
  if (now - Number(pending.at || 0) > PENDING_MS) return false;
  const a = Buffer.from(String(pending.state));
  const b = Buffer.from(state);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function tokenCall(fetchFn, provider, params) {
  const p = PROVIDERS[provider];
  const c = client(provider);
  if (!p || !c) throw new Error(`${provider} isn't set up yet.`);
  const headers = { accept: 'application/json' };
  const fields = { ...params };
  if (p.clientAuth === 'basic') headers.authorization = `Basic ${Buffer.from(`${c.id}:${c.secret}`).toString('base64')}`;
  else Object.assign(fields, { [p.idParam || 'client_id']: c.id, [p.secretParam || 'client_secret']: c.secret });
  if (p.codeParam && fields.code) {
    fields[p.codeParam] = fields.code;
    delete fields.code;
    delete fields.grant_type;
    delete fields.redirect_uri;
  }
  let body;
  if (p.json) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(fields);
  } else {
    headers['content-type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams(fields).toString();
  }
  let res;
  try {
    res = await fetchFn(p.tokenUrl, { method: 'POST', headers, body, redirect: 'error' });
  } catch {
    throw new Error(`${p.name} didn't answer. Try again in a minute.`);
  }
  let out = {};
  try {
    out = await res.json();
  } catch {
    /* handled below */
  }
  // TikTok For Business wraps the answer: { code: 0, data: { access_token, ... } }.
  if (p.bare && out && typeof out === 'object' && out.data && out.code === 0) out = { ...out.data, advertiser_ids: out.data.advertiser_ids };
  // Slack answers 200 with ok: false; the others use the status.
  if (!res.ok || out.ok === false || out.error || !(out.access_token || (out.authed_user && out.authed_user.access_token))) {
    throw new Error(`${p.name} didn't let 127 connect. Try again, and approve every permission it asks for.`);
  }
  const access = out.access_token || out.authed_user.access_token;
  const expiresIn = Number(out.expires_in || out.access_token_expires_in || 0);
  return {
    access,
    refresh: out.refresh_token || params.refresh_token || null,
    expiresAt: expiresIn > 0 ? Date.now() + expiresIn * 1000 : null,
    scope: String(out.scope || ''),
    // What some providers say about whose account it is (no personal details kept).
    account: out.team ? out.team.name : out.realmId || out.open_id || out.merchant_id || out.workspace_name || null,
    accounts: Array.isArray(out.advertiser_ids) ? out.advertiser_ids.map(String).slice(0, 50) : undefined,
  };
}

function exchange(fetchFn, pending, code, base) {
  const params = { grant_type: 'authorization_code', code: String(code || ''), redirect_uri: redirectUri(base, pending.provider) };
  if (pending.verifier) params.code_verifier = pending.verifier;
  return tokenCall(fetchFn, pending.provider, params);
}

// A fresh access token: the one held while it has a minute left, else a refresh. Null when it can't refresh.
async function fresh(fetchFn, provider, tokens) {
  if (!tokens || !tokens.access) return null;
  if (!tokens.expiresAt || tokens.expiresAt - Date.now() > 60 * 1000) return { tokens, changed: false };
  if (!tokens.refresh) return null;
  const t = await tokenCall(fetchFn, provider, { grant_type: 'refresh_token', refresh_token: tokens.refresh });
  return { tokens: { ...tokens, ...t, refresh: t.refresh || tokens.refresh }, changed: true };
}

module.exports = { PROVIDERS, known, client, ready, redirectUri, start, matches, exchange, fresh, PENDING_MS, META_V };
