// HQ in Microsoft Teams: 127's own Teams app (a bot) in the member's organization. It sends the member HQ's OK
// cards and the morning pulse in their personal chat with HQ. Legal L93 (legal/handoffs/hub-apps.md section 1,
// and the Microsoft Teams row in section 2):
//
// SL1 Only the linked member. The member gets a one-time code in HQ while signed in, then types `link <code>` in
//     their personal chat with HQ in Teams. A request counts only when its Bot Framework token checks out (Teams'
//     token check: RS256 from Microsoft's published keys, issuer, audience, expiry and the token's serviceUrl) and
//     its user (tenant and Microsoft Entra object id) is the linked one.
// SL2 One card, one action. Each card works once, only while its HQ item is open, and only if nothing in the
//     step changed since it was posted (a hash of what it showed).
// SL3 The same facts as HQ: what happens, the exact text of each item, the account. A step that asks for a
//     choice or edits, or doesn't fit, says "Open in HQ to OK" with no OK button.
// SL4 HQ-only: anything that charges, spends or moves money, deletes, publishes a site or changes an ad budget.
// SL5 Cards go only to the member's personal chat with the app, never to a channel or group chat.
// SL6 A held act tool (not in ACT_CLEARED) never gets an OK button.
// SL7 The Activity log says "OK'd in Teams".
// The Teams row: no copies of chats. HQ reads only messages sent to it, live, and keeps none of their text. In a
// channel or group chat it answers only when @mentioned, with one line pointing to the personal chat.
// Uninstalling the app deletes what HQ keeps for that member at once.
//
// The pulse comes from nudges.pulse(user, { channel: 'teams' }), which returns null unless the member turned
// Teams on in HQ (You > Out of HQ) and outside their quiet hours; its footer goes on every message (NU10).
// HQ_TEAMS=admins|on (default off). Needs 127's Azure Bot (a multi-tenant Microsoft Entra app registration):
// TEAMS_APP_ID and TEAMS_APP_SECRET. The Teams app manifest (teams/manifest.json) uses the same id.

const crypto = require('crypto');
const hq = require('../hq');
const needsLib = require('./needs');
const ok = require('./okcards');
const { scrubKeys } = require('./text');

const deps = {
  db: require('../db'),
  fetch: (...a) => fetch(...a),
  now: () => Date.now(),
  base: () => process.env.BASE_URL || 'https://127group.io',
  engine: () => require('./engine'),
  packs: () => require('./packs'),
  nudges: () => require('./nudges'),
  posts: () => {
    try {
      return require('./posts');
    } catch {
      return null;
    }
  },
};
function _setDeps(over) {
  Object.assign(deps, over);
}

// Microsoft's Bot Framework: where its signing keys are published, who issues its tokens, and where a bot gets
// its own token to send with.
const OPENID = 'https://login.botframework.com/v1/.well-known/openidconfiguration';
const ISSUER = 'https://api.botframework.com';
const LOGIN = 'https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token';
const SCOPE = 'https://api.botframework.com/.default';
const CODE_MS = 10 * 60 * 1000;
const CARD_DAYS = 7;
const SKEW_S = 5 * 60;
const KEYS_MS = 24 * 3600 * 1000;
const REFETCH_MS = 5 * 60 * 1000;
const { MAX_ITEMS, MAX_TEXT, sha, clip } = ok;

class TeamsError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function flag() {
  const v = String(process.env.HQ_TEAMS || '').toLowerCase();
  if (v === 'on' || v === 'true') return needsLib.pagesLive() ? 'on' : 'admins';
  return v === 'admins' ? 'admins' : 'off';
}
const isAdmin = (user) => require('./connectors').isAdmin(user);
function on(user) {
  const m = flag();
  return !!user && hq.canUse(user) && (m === 'on' || (m === 'admins' && isAdmin(user)));
}
const env = (k) => String(process.env[k] || '').trim();
const ready = () => !!(env('TEAMS_APP_ID') && env('TEAMS_APP_SECRET'));
const iso = () => new Date(deps.now()).toISOString();
const firstName = (u) => (u && u.name ? String(u.name).trim().split(/\s+/)[0] : 'the member');

// Opens HQ's app in Teams (the manifest's id is the bot's id), where the member adds it or opens the chat.
const appLink = () => (ready() ? `https://teams.microsoft.com/l/app/${encodeURIComponent(env('TEAMS_APP_ID'))}` : null);

// ---------- Teams' token check (SL1) ----------

let keys = { at: 0, tried: 0, map: new Map() };
const b64json = (s) => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));

async function getJson(url) {
  const res = await deps.fetch(url, { headers: { accept: 'application/json' }, redirect: 'error' });
  if (!res.ok) throw new TeamsError(`Microsoft said no (${res.status}).`, res.status);
  return res.json();
}

// Microsoft's signing keys, from the OpenID document's jwks_uri. Cached a day; fetched again when a token names
// a key HQ hasn't seen (at most every 5 minutes, so junk tokens can't make HQ hammer Microsoft).
async function loadKeys() {
  keys.tried = deps.now();
  const conf = await getJson(OPENID);
  const ju = new URL(String(conf.jwks_uri || ''));
  if (ju.protocol !== 'https:' || !ju.hostname.endsWith('.botframework.com')) throw new TeamsError('Unexpected key address.');
  const set = await getJson(ju.toString());
  const map = new Map();
  for (const k of set.keys || []) {
    if (k.kty !== 'RSA' || !k.kid || !k.n || !k.e) continue;
    try {
      map.set(String(k.kid), { pub: crypto.createPublicKey({ key: { kty: 'RSA', n: k.n, e: k.e }, format: 'jwk' }), endorsements: Array.isArray(k.endorsements) ? k.endorsements.map(String) : null });
    } catch {
      /* a key node can't read is skipped */
    }
  }
  keys = { at: deps.now(), tried: keys.tried, map };
}

async function keyFor(kid) {
  const fresh = deps.now() - keys.at < KEYS_MS;
  if (fresh && keys.map.has(kid)) return keys.map.get(kid);
  if (!fresh || deps.now() - keys.tried >= REFETCH_MS) await loadKeys();
  return keys.map.get(kid) || null;
}

// The Authorization header on every request from Teams: a Bot Framework JWT. True only when it is RS256, signed
// by a current Microsoft key endorsed for this channel, issued by api.botframework.com, meant for HQ's app id,
// in date (5 minutes' skew), and its serviceUrl is the activity's.
async function verify(auth, activity) {
  try {
    const appId = env('TEAMS_APP_ID');
    const m = /^Bearer ([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(String(auth || ''));
    if (!m || !appId || !activity || typeof activity !== 'object') return false;
    const head = b64json(m[1]);
    const claims = b64json(m[2]);
    if (head.alg !== 'RS256' || !head.kid) return false;
    const key = await keyFor(String(head.kid));
    if (!key) return false;
    if (key.endorsements && !key.endorsements.includes(String(activity.channelId || ''))) return false;
    if (!crypto.verify('RSA-SHA256', Buffer.from(`${m[1]}.${m[2]}`), key.pub, Buffer.from(m[3], 'base64url'))) return false;
    const t = deps.now() / 1000;
    if (claims.iss !== ISSUER) return false;
    if (!(Array.isArray(claims.aud) ? claims.aud.includes(appId) : claims.aud === appId)) return false;
    if (typeof claims.exp !== 'number' || claims.exp + SKEW_S < t) return false;
    if (claims.nbf != null && (typeof claims.nbf !== 'number' || claims.nbf - SKEW_S > t)) return false;
    const su = claims.serviceurl || claims.serviceUrl;
    return typeof su === 'string' && su.length > 0 && su === activity.serviceUrl;
  } catch {
    return false;
  }
}

// ---------- sending ----------

// Only Microsoft's own Bot Framework hosts. Teams documents smba.trafficmanager.net (by region) and
// smba.infra.gcc.teams.microsoft.com (GCC); other channels use *.botframework.com. Any *.trafficmanager.net
// name can be anyone's, so only smba.trafficmanager.net itself.
function serviceBase(url) {
  let u;
  try {
    u = new URL(String(url || ''));
  } catch {
    throw new TeamsError("That isn't a Teams address.");
  }
  const h = u.hostname.toLowerCase();
  const host = h === 'smba.trafficmanager.net' || h.endsWith('.botframework.com') || h.endsWith('.teams.microsoft.com');
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443') || !host) throw new TeamsError("That isn't a Teams address.");
  return u.toString().replace(/\/?$/, '/');
}

let botTok = null;
async function botToken() {
  const id = env('TEAMS_APP_ID');
  if (botTok && botTok.app === id && botTok.until > deps.now()) return botTok.token;
  let out;
  try {
    const res = await deps.fetch(LOGIN, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: env('TEAMS_APP_SECRET'), scope: SCOPE }).toString(), redirect: 'error' });
    out = await res.json();
  } catch {
    throw new TeamsError("Microsoft didn't answer. Try again in a minute.", 0);
  }
  if (!out || !out.access_token) throw new TeamsError(`Microsoft said no (${(out && out.error) || 'no token'}).`);
  const life = Math.max(60, Number(out.expires_in) || 3600);
  botTok = { app: id, token: String(out.access_token), until: deps.now() + (life - 300) * 1000 };
  return botTok.token;
}

// POST a new activity to a conversation (or a reply to one), or PUT a new version of one HQ sent.
async function api(serviceUrl, conversation, activity, { replace = null, replyTo = null } = {}) {
  const base = serviceBase(serviceUrl);
  const tail = replace || replyTo ? `/${encodeURIComponent(replace || replyTo)}` : '';
  const url = `${base}v3/conversations/${encodeURIComponent(conversation)}/activities${tail}`;
  const token = await botToken();
  let res;
  try {
    res = await deps.fetch(url, { method: replace ? 'PUT' : 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json; charset=utf-8', accept: 'application/json' }, body: JSON.stringify(activity), redirect: 'error' });
  } catch {
    throw new TeamsError("Teams didn't answer. Try again in a minute.", 0);
  }
  if (!res.ok) throw new TeamsError(`Teams said no (${res.status}).`, res.status === 429 ? 429 : 400);
  try {
    return (await res.json()) || {};
  } catch {
    return {};
  }
}

const say = (serviceUrl, conversation, text, opts) => api(serviceUrl, conversation, { type: 'message', textFormat: 'markdown', text }, opts);
const cardMsg = (card, summary) => ({ type: 'message', summary, attachments: [{ contentType: 'application/vnd.microsoft.card.adaptive', content: card }] });
const toMember = (d, activity, opts) => api(d.serviceUrl, d.conversation, activity, opts);

// ---------- the member's link ----------

// A one-time code the member types in their chat with HQ as `link <code>` (SL1). Shown once, good for 10 minutes.
async function newCode(user) {
  const d = deps.db.get('hqTeams', user.id) || { id: user.id, memberId: user.id, linked: null, cards: true, at: iso() };
  const code = String(crypto.randomInt(10000000, 99999999));
  d.code = { hash: sha(`teams:${code}`), until: deps.now() + CODE_MS };
  await deps.db.save('hqTeams', d);
  return code;
}

async function setCards(user, onOff) {
  const d = deps.db.get('hqTeams', user.id);
  if (!d) return;
  d.cards = !!onOff;
  await deps.db.save('hqTeams', d);
}

async function removeDoc(d) {
  for (const c of deps.db.filter('hqTeamsCards', (x) => x.memberId === d.memberId)) await deps.db.remove('hqTeamsCards', c.id);
  await deps.db.remove('hqTeams', d.id);
}

// Remove in HQ deletes what HQ keeps. A bot has no per-member token to revoke (it signs in as itself), so
// nothing is called at Microsoft; the member uninstalls the app in Teams to take it out of their chat list.
async function disconnect(user) {
  const d = deps.db.get('hqTeams', user.id);
  if (!d) return false;
  await removeDoc(d);
  return true;
}
const forget = async (userId) => {
  const d = deps.db.get('hqTeams', userId);
  if (d) await removeDoc(d);
};

function status(user) {
  const d = deps.db.get('hqTeams', user.id);
  return { ready: ready(), app: appLink(), linked: !!(d && d.linked), cards: !d || d.cards !== false, at: (d && d.linked && d.linked.at) || null };
}

// ---------- activities from Teams ----------

const tenantOf = (a) => String((a.conversation && a.conversation.tenantId) || (a.channelData && a.channelData.tenant && a.channelData.tenant.id) || '');
const aadOf = (a) => String((a.from && a.from.aadObjectId) || '');
const personal = (a) => !!(a.conversation && a.conversation.conversationType === 'personal');
const docFor = (a) => {
  const tenant = tenantOf(a);
  const aad = aadOf(a);
  return tenant && aad ? deps.db.find('hqTeams', (d) => d.linked && d.tenant === tenant && d.aadObjectId === aad) : null;
};
const userOf = (d) => d && deps.db.get('users', d.memberId);
const mentioned = (a) => (a.entities || []).some((e) => e && e.type === 'mention' && e.mentioned && a.recipient && e.mentioned.id === a.recipient.id);
// What the member typed, without Teams' <at> tags or other markup. Read for the command, never kept.
const plain = (s) => String(s || '').replace(/<at>[^<]*<\/at>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim();

const HELP = 'Type **oks** for anything waiting on your OK, or **pulse** for yesterday in numbers. Everything else is in HQ.';
const ELSEWHERE = 'HQ only works in your personal chat with it. Open a chat with HQ to see your OK cards.';
const HELLO = `Hi. To link this chat to your HQ, open HQ, go to Teams and get a link code, then type **link** and the code here. ${HELP}`;

// link <code> | oks | pulse | help, in the member's personal chat. Returns the reply's text.
async function command(a) {
  const [verb, arg] = plain(a.text).split(/\s+/);
  const v = String(verb || 'help').toLowerCase();
  const tenant = tenantOf(a);
  const aad = aadOf(a);
  if (v === 'link') {
    if (!tenant || !aad) return 'This only works with a work or school Teams account.';
    const sec = require('../security');
    if (!sec.allow(`teams-link:${tenant}:${aad}`, 10, 3600 * 1000) || !sec.allow(`teams-link:${tenant}`, 50, 3600 * 1000)) return 'Too many tries. Wait an hour and get a new code in HQ.';
    const h = sha(`teams:${String(arg || '')}`);
    const d = deps.db.find('hqTeams', (x) => x.code && x.code.hash === h && x.code.until > deps.now());
    if (!d) return "That code didn't work. Get a new one in HQ, under Teams.";
    if (deps.db.find('hqTeams', (x) => x.id !== d.id && x.linked && x.tenant === tenant && x.aadObjectId === aad)) return 'This Teams account is already linked to another HQ.';
    Object.assign(d, { tenant, aadObjectId: aad, teamsUser: String(a.from.id || ''), serviceUrl: serviceBase(a.serviceUrl), conversation: String(a.conversation.id), linked: { at: iso() }, code: null, cards: d.cards !== false });
    await deps.db.save('hqTeams', d);
    return `Linked. HQ will send your OK cards here, only to you. ${HELP}`;
  }
  const d = docFor(a);
  if (!d) return "This Teams account isn't linked to an HQ. Open HQ, go to Teams, and follow the steps.";
  const user = userOf(d);
  if (!user || !on(user)) return 'HQ in Teams is off for this account right now.';
  // Teams can move a chat to another regional address; keep the one it last used.
  if (d.conversation !== String(a.conversation.id) || d.serviceUrl !== serviceBase(a.serviceUrl)) {
    Object.assign(d, { conversation: String(a.conversation.id), serviceUrl: serviceBase(a.serviceUrl) });
    await deps.db.save('hqTeams', d);
  }
  if (v === 'oks') {
    const n = await sendCards(user, d, { all: true });
    return n ? `Sent ${n === 1 ? 'one card' : `${n} cards`} to this chat.` : 'Nothing is waiting on your OK.';
  }
  if (v === 'pulse') {
    const sent = await sendPulse(user, d, { force: true });
    if (sent === true) return 'Sent.';
    return sent === 'off' ? 'The pulse in Teams is off. Turn it on in HQ, under You.' : sent === 'quiet' ? "It's your quiet hours, so HQ holds it until morning." : 'Nothing to report from yesterday yet.';
  }
  return HELP;
}

// ---------- cards ----------

const text = (t, more = {}) => ({ type: 'TextBlock', text: t, wrap: true, ...more });
// Text from a step (titles, notes, each item's exact words) goes in TextRuns, which Teams shows as written,
// never as markdown.
const exact = (t, more = {}) => ({ type: 'RichTextBlock', inlines: [{ type: 'TextRun', text: String(t), ...more }] });
const adaptive = (body, actions = []) => ({ type: 'AdaptiveCard', $schema: 'http://adaptivecards.io/schemas/adaptive-card.json', version: '1.5', body, ...(actions.length ? { actions } : {}) });

// The card for one open inbox item: { okable, card, text, hash }.
function cardFor(user, item, cardId) {
  const engine = deps.engine();
  const run = engine.get(user, item.runId);
  const st = run && run.steps[item.stepId];
  const wf = run && deps.packs().workflow(run.workflowId);
  if (!st || st.status !== 'waiting' || !wf) return null;
  const spec = st.spec || {};
  const items = spec.items || [];
  const { okable, reason } = ok.decide(spec, ok.gate(wf, item.stepId, engine, deps.packs()));
  const link = `${deps.base()}/app/hq/runs/${encodeURIComponent(run.id)}`;
  const body = [exact(clip(spec.title || item.title, 150), { weight: 'Bolder', size: 'Medium' }), exact(clip(run.title, 150), { isSubtle: true })];
  if (spec.note) body.push(exact(clip(spec.note, 2000), { size: 'Small' }));
  for (const i of items.slice(0, MAX_ITEMS)) body.push({ type: 'Container', separator: true, items: [exact(clip(i.label, 150), { weight: 'Bolder' }), exact(clip(i.text, MAX_TEXT))] });
  let actions;
  if (okable) {
    actions = [
      { type: 'Action.Submit', title: ok.okLabel(spec), style: 'positive', data: { hq: cardId, a: 'ok' } },
      { type: 'Action.Submit', title: 'Not now', data: { hq: cardId, a: 'skip' } },
      { type: 'Action.OpenUrl', title: 'Open in HQ', url: link },
    ];
  } else {
    actions = [{ type: 'Action.OpenUrl', title: 'Open in HQ to OK', url: link }];
    body.push(text(reason, { size: 'Small', isSubtle: true }));
  }
  return { okable, card: adaptive(body, actions), text: `Needs your OK: ${clip(spec.title || item.title, 150)}`, hash: ok.hashOf(spec) };
}

// Posts a card for each open item that has none yet (or every open one with all: true). SL5: only ever to the
// member's personal chat with HQ.
async function sendCards(user, d, { all = false } = {}) {
  if (!d.linked || d.cards === false || !d.conversation) return 0;
  let n = 0;
  const open = deps.db.filter('inbox', (i) => i.memberId === user.id && i.status === 'open' && (i.kind || 'approve') === 'approve');
  for (const item of open.slice(0, 20)) {
    const had = deps.db.find('hqTeamsCards', (c) => c.itemId === item.id && !c.used);
    if (had && !all) continue;
    const id = crypto.randomBytes(18).toString('base64url');
    const card = cardFor(user, item, id);
    if (!card) continue;
    if (had) {
      had.used = 'replaced';
      await deps.db.save('hqTeamsCards', had);
    }
    const out = await toMember(d, cardMsg(card.card, card.text));
    await deps.db.save('hqTeamsCards', { id, memberId: user.id, itemId: item.id, runId: item.runId, stepId: item.stepId, hash: card.hash, okable: card.okable, until: deps.now() + CARD_DAYS * 864e5, activityId: out.id || null, used: null, at: iso() });
    n += 1;
  }
  return n;
}

const stamp = () => iso().slice(0, 16).replace('T', ' ');
const ANSWERED = (what, title) => adaptive([title ? { type: 'RichTextBlock', inlines: [{ type: 'TextRun', text: `${what} `, weight: 'Bolder' }, { type: 'TextRun', text: clip(title, 150) }] } : text(what), text(`In Teams, ${stamp()}`, { size: 'Small', isSubtle: true })]);

// A tap on a card's OK or Not now. Returns { reply } to answer in the chat, or { replace } for the card's new body.
async function action(a, data) {
  const card = deps.db.get('hqTeamsCards', String((data && data.hq) || ''));
  const d = card && deps.db.get('hqTeams', card.memberId);
  const owner = d && userOf(d);
  if (!card || !d || !owner) return { reply: 'This card is no longer active. Open HQ to answer.' };
  if (!personal(a) || !d.linked || d.tenant !== tenantOf(a) || d.aadObjectId !== aadOf(a) || d.conversation !== String(a.conversation.id)) return { reply: `Only ${firstName(owner)} can OK this.` };
  if (!on(owner)) return { reply: 'HQ in Teams is off for this account right now.' };
  if (card.used) return { reply: 'This card was already used.' };
  if (!card.okable || (data.a !== 'ok' && data.a !== 'skip')) return { reply: 'Open HQ to answer this one.' };
  const item = deps.db.get('inbox', card.itemId);
  if (!item || item.status !== 'open' || card.until < deps.now()) {
    card.used = 'expired';
    await deps.db.save('hqTeamsCards', card);
    return { replace: ANSWERED('This card expired. Open HQ to see where it stands.') };
  }
  // SL2: the step must still be exactly what the card showed.
  const now = cardFor(owner, item, card.id);
  if (!now || now.hash !== card.hash || !now.okable) {
    card.used = 'void';
    await deps.db.save('hqTeamsCards', card);
    return { replace: ANSWERED('Something changed since this card was sent, so it no longer works. Open HQ to see it.') };
  }
  card.used = data.a;
  await deps.db.save('hqTeamsCards', card);
  const engine = deps.engine();
  const spec = engine.get(owner, card.runId).steps[card.stepId].spec || {};
  try {
    await engine.answer(owner, card.runId, card.stepId, ok.answerFor(spec, data.a === 'ok'), { who: 'you', via: 'Teams' });
  } catch (err) {
    return { replace: ANSWERED(`HQ couldn't take that: ${err.message}`) };
  }
  return { replace: ANSWERED(data.a === 'ok' ? "OK'd:" : 'Not now:', spec.title) };
}

// Shows the result of a tap: the card changes in place, or a line in the chat.
async function settle(a, out) {
  const card = deps.db.get('hqTeamsCards', String(((a.value && a.value.action && a.value.action.data) || a.value || {}).hq || ''));
  if (out.replace && card && card.activityId) {
    const d = deps.db.get('hqTeams', card.memberId);
    if (d) {
      await toMember(d, { ...cardMsg(out.replace, 'Answered'), id: card.activityId }, { replace: card.activityId });
      return;
    }
  }
  await say(a.serviceUrl, String(a.conversation.id), out.reply || 'Answered.');
}

// Install, uninstall: removing the app (installationUpdate remove, or HQ taken out of the chat) deletes what HQ
// keeps for that member at once. Adding it in a personal chat says how to link.
async function lifecycle(a) {
  const botId = a.recipient && a.recipient.id;
  const removed = (a.type === 'installationUpdate' && /^remove/.test(String(a.action || ''))) || (a.type === 'conversationUpdate' && (a.membersRemoved || []).some((m) => m && m.id === botId));
  if (removed) {
    const tenant = tenantOf(a);
    const aad = aadOf(a);
    const conv = String((a.conversation && a.conversation.id) || '');
    for (const d of deps.db.filter('hqTeams', (x) => (conv && x.conversation === conv) || (personal(a) && tenant && aad && x.tenant === tenant && x.aadObjectId === aad))) await removeDoc(d);
    return;
  }
  const added = (a.type === 'installationUpdate' && a.action === 'add') || (a.type === 'conversationUpdate' && (a.membersAdded || []).some((m) => m && m.id === botId));
  if (added && personal(a)) await say(a.serviceUrl, String(a.conversation.id), HELLO);
}

// Every verified activity. Returns { status, body } for the HTTP answer (an invoke needs a body).
async function handle(a) {
  if (!a || typeof a !== 'object' || !a.conversation) return { status: 400 };
  if (a.type === 'installationUpdate' || a.type === 'conversationUpdate') {
    await lifecycle(a);
    return { status: 200 };
  }
  if (a.type === 'invoke') {
    const data = a.name === 'adaptiveCard/action' ? a.value && a.value.action && a.value.action.data : a.value;
    if (!data || !data.hq) return { status: 200, body: { statusCode: 200, type: 'application/vnd.microsoft.activity.message', value: 'Open HQ to answer this one.' } };
    const out = await action(a, data);
    if (out.replace) await settle(a, out).catch((err) => console.warn('[teams] update', scrubKeys(String(err.message))));
    return { status: 200, body: { statusCode: 200, type: 'application/vnd.microsoft.activity.message', value: out.reply || 'Answered.' } };
  }
  if (a.type !== 'message') return { status: 200 };
  // A channel or group chat: never read past whether HQ was @mentioned, and keep nothing.
  if (!personal(a)) {
    if (mentioned(a)) await say(a.serviceUrl, String(a.conversation.id), ELSEWHERE, { replyTo: a.id || null });
    return { status: 200 };
  }
  if (a.value && a.value.hq) {
    await settle(a, await action(a, a.value));
    return { status: 200 };
  }
  await say(a.serviceUrl, String(a.conversation.id), await command(a));
  return { status: 200 };
}

// ---------- the pulse ----------

const md = (s) => String(s).replace(/([\\[\]()*_`~#>])/g, '\\$1');

async function sendPulse(user, d, { force = false } = {}) {
  const nudges = deps.nudges();
  if (typeof nudges.sendable !== 'function') return 'off';
  const can = nudges.sendable(user, 'teams');
  if (!can.ok) return can.why;
  const posts = deps.posts();
  const posted = posts && typeof posts.counts === 'function' ? (u, day) => {
    const start = Date.parse(`${day}T05:00:00Z`);
    return posts.counts(u, { since: start, until: start + 864e5 });
  } : null;
  const p = await nudges.pulse(user, { channel: 'teams', shared: false, posted });
  if (!p) return 'empty';
  if (!force && d.lastPulse === p.day) return 'sent';
  const base = deps.base();
  const body = [text(p.label, { weight: 'Bolder', size: 'Medium' }), ...p.lines.map((l) => text(`- ${md(l.text)}`, { spacing: 'Small' }))];
  if (p.nextStep) body.push(text(p.nextStep.href ? `[${md(p.nextStep.text)}](${base}${p.nextStep.href})` : md(p.nextStep.text)));
  body.push(text(`${md(p.footer.why)} [Settings](${base}${p.footer.settings}) · [Stop these](${base}${p.footer.stop})`, { size: 'Small', isSubtle: true, separator: true }));
  await toMember(d, cardMsg(adaptive(body), `${p.label}: ${p.lines.map((l) => l.text).join(' ')}`));
  d.lastPulse = p.day;
  await deps.db.save('hqTeams', d);
  return true;
}

let busy = false;
// Every minute (server.js): new OK cards, and the pulse once a day when the member has it on.
async function tick() {
  if (busy || flag() === 'off' || !ready()) return 0;
  busy = true;
  let n = 0;
  try {
    for (const d of deps.db.filter('hqTeams', (x) => x.linked)) {
      const user = userOf(d);
      if (!user || !on(user)) continue;
      try {
        n += await sendCards(user, d);
        if ((await sendPulse(user, d)) === true) n += 1;
      } catch (err) {
        console.warn('[teams] send', scrubKeys(String(err.message)));
      }
    }
  } finally {
    busy = false;
  }
  return n;
}

const _reset = () => {
  keys = { at: 0, tried: 0, map: new Map() };
  botTok = null;
};

module.exports = { TeamsError, flag, on, ready, appLink, newCode, setCards, disconnect, forget, status, verify, serviceBase, command, cardFor, sendCards, action, handle, sendPulse, tick, _setDeps, _reset };
