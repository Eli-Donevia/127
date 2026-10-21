// HQ in Slack: 127's own Slack app in the member's workspace. It sends the member HQ's OK cards and the
// morning pulse in a direct message, and answers /127. Legal L93 (legal/handoffs/hub-apps.md section 1):
//
// SL1 Only the linked member. The member adds the app from HQ, then links their Slack user by typing
//     `/127 link <code>` with a one-time code HQ shows while they're signed in. A request counts only when its
//     Slack signature checks out (timestamp under 5 minutes old) and its user is the linked one.
// SL2 One card, one action. Each card works once, only while its HQ item is open, and only if nothing in the
//     step changed since it was posted (a hash of what it showed).
// SL3 The same facts as HQ: what happens, the exact text of each item, the account. A step that asks for a
//     choice or edits, or doesn't fit, says "Open in HQ to OK" with no OK button.
// SL4 HQ-only: anything that charges, spends or moves money, deletes, publishes a site or changes an ad budget.
// SL5 Cards go only to the member's DM with the app, never to a channel.
// SL6 A held act tool (not in ACT_CLEARED) never gets an OK button.
// SL7 The Activity log says "OK'd in Slack".
// Uninstalling the app deletes what HQ keeps for that workspace at once (Slack's 14 business days).
//
// The pulse comes from nudges.pulse(user, { channel: 'slack' }), which returns null unless the member turned
// Slack on in HQ (You > Out of HQ) and outside their quiet hours; its footer goes on every message (NU10).
// HQ_SLACK=admins|on (default off). Needs 127's Slack app: OAUTH_SLACK_ID, OAUTH_SLACK_SECRET and
// SLACK_SIGNING_SECRET (the same app as the Slack connector, with this callback added).

const crypto = require('crypto');
const hq = require('../hq');
const needsLib = require('./needs');
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

const API = 'https://slack.com/api';
const SCOPES = ['chat:write', 'commands', 'im:write'];
const CODE_MS = 10 * 60 * 1000;
const CARD_DAYS = 7;
const SKEW_S = 5 * 60;
const MAX_ITEMS = 5;
const MAX_TEXT = 2800;
// SL4: an act step that needs one of these, or whose tool name says it, stays in HQ.
const MONEY = new Set(['stripe', 'square', 'paypal', 'quickbooks', 'xero', 'gumroad', 'etsy', 'shopify', 'meta_ads', 'google_ads', 'tiktok_ads', 'netlify', 'lemonsqueezy', 'polar', 'whop']);
const HQ_ONLY_NAME = /refund|charge|pay|invoice|price|budget|spend|delete|remove|publish|deploy/i;

class SlackError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function flag() {
  const v = String(process.env.HQ_SLACK || '').toLowerCase();
  if (v === 'on' || v === 'true') return needsLib.pagesLive() ? 'on' : 'admins';
  return v === 'admins' ? 'admins' : 'off';
}
const isAdmin = (user) => require('./connectors').isAdmin(user);
function on(user) {
  const m = flag();
  return !!user && hq.canUse(user) && (m === 'on' || (m === 'admins' && isAdmin(user)));
}
const env = (k) => String(process.env[k] || '').trim();
const ready = () => !!(env('OAUTH_SLACK_ID') && env('OAUTH_SLACK_SECRET') && env('SLACK_SIGNING_SECRET'));
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const iso = () => new Date(deps.now()).toISOString();
const firstName = (u) => (u && u.name ? String(u.name).trim().split(/\s+/)[0] : 'the member');

// ---------- the install ----------

const redirectUri = (base) => `${base}/app/hq/slack/callback`;
function installUrl(user, base) {
  if (!ready()) return null;
  const state = crypto.randomBytes(24).toString('base64url');
  const u = new URL('https://slack.com/oauth/v2/authorize');
  u.searchParams.set('client_id', env('OAUTH_SLACK_ID'));
  u.searchParams.set('scope', SCOPES.join(','));
  u.searchParams.set('redirect_uri', redirectUri(base));
  u.searchParams.set('state', state);
  return { url: u.toString(), pending: { state, at: deps.now(), member: user.id } };
}

async function api(method, token, body, { form = false } = {}) {
  const headers = { accept: 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  let payload;
  if (form) {
    headers['content-type'] = 'application/x-www-form-urlencoded';
    payload = new URLSearchParams(body).toString();
  } else if (body) {
    headers['content-type'] = 'application/json; charset=utf-8';
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await deps.fetch(`${API}/${method}`, { method: 'POST', headers, body: payload, redirect: 'error' });
  } catch {
    throw new SlackError("Slack didn't answer. Try again in a minute.", 0);
  }
  let out;
  try {
    out = await res.json();
  } catch {
    out = null;
  }
  if (!out || !out.ok) throw new SlackError(`Slack said no (${(out && out.error) || res.status}).`, res.status === 429 ? 429 : 400);
  return out;
}

async function finishInstall(user, pending, { code, state, error } = {}, base) {
  const fresh = pending && pending.member === user.id && deps.now() - pending.at < 15 * 60 * 1000;
  const a = Buffer.from(String(state || ''));
  const b = Buffer.from(String((pending && pending.state) || ''));
  if (!fresh || a.length !== b.length || !a.length || !crypto.timingSafeEqual(a, b)) return { error: "That didn't match the request HQ sent. Try Add to Slack again." };
  if (error || !code) return { error: 'Slack was not added.' };
  let out;
  try {
    out = await api('oauth.v2.access', null, { code: String(code), redirect_uri: redirectUri(base), client_id: env('OAUTH_SLACK_ID'), client_secret: env('OAUTH_SLACK_SECRET') }, { form: true });
  } catch (err) {
    return { error: err.message };
  }
  if (!out.access_token || !out.team || !out.team.id) return { error: "Slack didn't send what HQ needs. Try again." };
  const old = deps.db.get('hqSlack', user.id);
  if (old) await removeDoc(old);
  await deps.db.save('hqSlack', {
    id: user.id, memberId: user.id, team: { id: String(out.team.id), name: String(out.team.name || '').slice(0, 120) },
    bot: hq.enc(out.access_token), botUser: out.bot_user_id || null, linked: null, code: null, cards: true, at: iso(),
  });
  return { ok: true };
}

// A one-time code the member types in Slack as `/127 link <code>` (SL1). Shown once, good for 10 minutes.
async function newCode(user) {
  const d = deps.db.get('hqSlack', user.id);
  if (!d) return null;
  const code = String(crypto.randomInt(10000000, 99999999));
  d.code = { hash: sha(`${d.team.id}:${code}`), until: deps.now() + CODE_MS };
  await deps.db.save('hqSlack', d);
  return code;
}

async function setCards(user, onOff) {
  const d = deps.db.get('hqSlack', user.id);
  if (!d) return;
  d.cards = !!onOff;
  await deps.db.save('hqSlack', d);
}

async function removeDoc(d) {
  for (const c of deps.db.filter('hqSlackCards', (x) => x.memberId === d.memberId)) await deps.db.remove('hqSlackCards', c.id);
  await deps.db.remove('hqSlack', d.id);
}

async function disconnect(user) {
  const d = deps.db.get('hqSlack', user.id);
  if (!d) return false;
  try {
    await api('auth.revoke', hq.dec(d.bot), null);
  } catch {
    /* deleted here either way */
  }
  await removeDoc(d);
  return true;
}
const forget = async (userId) => {
  const d = deps.db.get('hqSlack', userId);
  if (d) await removeDoc(d);
};

function status(user) {
  const d = deps.db.get('hqSlack', user.id);
  if (!d) return { added: false, ready: ready() };
  return { added: true, ready: ready(), team: d.team.name, linked: !!d.linked, cards: d.cards !== false, at: d.at };
}

// ---------- requests from Slack ----------

// Slack's signing check: v0=HMAC-SHA256(secret, "v0:<timestamp>:<raw body>"), timestamp within 5 minutes.
function verify(raw, headers) {
  const secret = env('SLACK_SIGNING_SECRET');
  const ts = Number(headers['x-slack-request-timestamp']);
  const sig = String(headers['x-slack-signature'] || '');
  if (!secret || !Number.isFinite(ts) || Math.abs(deps.now() / 1000 - ts) > SKEW_S || !Buffer.isBuffer(raw)) return false;
  const want = `v0=${crypto.createHmac('sha256', secret).update(`v0:${ts}:${raw.toString('utf8')}`).digest('hex')}`;
  const a = Buffer.from(sig);
  const b = Buffer.from(want);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const docFor = (team, slackUser) => deps.db.find('hqSlack', (d) => d.team.id === String(team) && d.linked && d.linked.user === String(slackUser));
const userOf = (d) => d && deps.db.get('users', d.memberId);

const HELP = 'Type `/127 oks` for anything waiting on your OK, or `/127 pulse` for yesterday in numbers. Everything else is in HQ.';

// /127 link <code> | oks | pulse | help. Returns the ephemeral reply's text.
async function command({ team_id: team, user_id: who, text }) {
  const [verb, arg] = String(text || '').trim().split(/\s+/);
  const v = String(verb || 'help').toLowerCase();
  if (v === 'link') {
    const h = sha(`${team}:${String(arg || '')}`);
    const d = deps.db.find('hqSlack', (x) => x.team.id === String(team) && x.code && x.code.hash === h && x.code.until > deps.now());
    if (!d) return "That code didn't work. Get a new one in HQ, under Slack.";
    if (deps.db.find('hqSlack', (x) => x.id !== d.id && x.team.id === String(team) && x.linked && x.linked.user === String(who))) return 'This Slack account is already linked to another HQ.';
    d.linked = { user: String(who), at: iso() };
    d.code = null;
    await deps.db.save('hqSlack', d);
    return `Linked. HQ will send your OK cards here, only to you. ${HELP}`;
  }
  const d = docFor(team, who);
  if (!d) return 'This Slack account isn\'t linked to an HQ. Open HQ, go to Slack, and follow the steps.';
  const user = userOf(d);
  if (!user || !on(user)) return 'HQ in Slack is off for this account right now.';
  if (v === 'oks') {
    const n = await sendCards(user, d, { all: true });
    return n ? `Sent ${n === 1 ? 'one card' : `${n} cards`} to this DM.` : 'Nothing is waiting on your OK.';
  }
  if (v === 'pulse') {
    const sent = await sendPulse(user, d, { force: true });
    if (sent === true) return 'Sent.';
    return sent === 'off' ? 'The pulse in Slack is off. Turn it on in HQ, under You.' : sent === 'quiet' ? "It's your quiet hours, so HQ holds it until morning." : 'Nothing to report from yesterday yet.';
  }
  return HELP;
}

// ---------- cards ----------

// What the step would do: the act tools it lets go ahead, and whether any is held or HQ-only.
function gate(wf, stepId) {
  const engine = deps.engine();
  const packs = deps.packs();
  const tools = wf.steps.filter((s) => s.approvedBy === stepId).map((s) => ({ name: s.tool, t: packs.tool(s.tool) })).filter((x) => x.t && x.t.risk === 'act');
  return {
    held: tools.some((x) => !engine.actCleared(x.name)),
    hqOnly: tools.some((x) => HQ_ONLY_NAME.test(x.name) || (x.t.needs || []).some((n) => MONEY.has(n))),
  };
}

const hashOf = (spec) => sha(JSON.stringify({ t: spec.title, n: spec.note, a: !!spec.act, o: (spec.options || []).map((o) => o.label), i: (spec.items || []).map((i) => [i.label, i.text]), e: spec.edit || null }));
const clip = (s, n) => (String(s || '').length > n ? `${String(s).slice(0, n - 1)}…` : String(s || ''));

// The card for one open inbox item: { okable, blocks, text }.
function cardFor(user, item, cardId) {
  const engine = deps.engine();
  const run = engine.get(user, item.runId);
  const st = run && run.steps[item.stepId];
  const wf = run && deps.packs().workflow(run.workflowId);
  if (!st || st.status !== 'waiting' || !wf) return null;
  const spec = st.spec || {};
  const g = gate(wf, item.stepId);
  const items = spec.items || [];
  const fits = !spec.options && !(spec.edit && !spec.act) && items.length <= MAX_ITEMS && items.every((i) => String(i.text || i.label || '').length <= MAX_TEXT);
  const okable = !g.held && !g.hqOnly && fits;
  const link = `${deps.base()}/app/hq/runs/${encodeURIComponent(run.id)}`;
  const blocks = [{ type: 'section', text: { type: 'mrkdwn', text: `*${clip(spec.title || item.title, 150)}*\n${clip(run.title, 150)}` } }];
  if (spec.note) blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: clip(spec.note, 2000) }] });
  for (const i of items.slice(0, MAX_ITEMS)) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*${clip(i.label, 150)}*\n${clip(i.text, MAX_TEXT)}` } });
  if (okable) {
    blocks.push({ type: 'actions', elements: [
      { type: 'button', style: 'primary', action_id: 'ok', value: cardId, text: { type: 'plain_text', text: spec.act ? (items.length > 1 ? `OK all ${items.length}` : 'OK') : 'Looks good' } },
      { type: 'button', action_id: 'skip', value: cardId, text: { type: 'plain_text', text: 'Not now' } },
      { type: 'button', action_id: 'open', url: link, text: { type: 'plain_text', text: 'Open in HQ' } },
    ] });
  } else {
    blocks.push({ type: 'actions', elements: [{ type: 'button', action_id: 'open', url: link, text: { type: 'plain_text', text: 'Open in HQ to OK' } }] });
    blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: g.held ? 'This one is waiting on 127 before it can run.' : g.hqOnly ? 'Money, deletes, publishing and ad budgets are OK\'d in HQ only.' : 'This one needs a choice or an edit, so it\'s answered in HQ.' }] });
  }
  return { okable, blocks, text: `Needs your OK: ${clip(spec.title || item.title, 150)}`, hash: hashOf(spec) };
}

async function dm(d, msg) {
  const token = hq.dec(d.bot);
  const ch = await api('conversations.open', token, { users: d.linked.user });
  return api('chat.postMessage', token, { channel: ch.channel.id, ...msg, unfurl_links: false, unfurl_media: false });
}

// Posts a card for each open item that has none yet (or every open one with all: true).
async function sendCards(user, d, { all = false } = {}) {
  if (!d.linked || d.cards === false) return 0;
  let n = 0;
  const open = deps.db.filter('inbox', (i) => i.memberId === user.id && i.status === 'open' && (i.kind || 'approve') === 'approve');
  for (const item of open.slice(0, 20)) {
    const had = deps.db.find('hqSlackCards', (c) => c.itemId === item.id && !c.used);
    if (had && !all) continue;
    const id = crypto.randomBytes(18).toString('base64url');
    const card = cardFor(user, item, id);
    if (!card) continue;
    if (had) {
      had.used = 'replaced';
      await deps.db.save('hqSlackCards', had);
    }
    const out = await dm(d, { text: card.text, blocks: card.blocks });
    await deps.db.save('hqSlackCards', { id, memberId: user.id, itemId: item.id, runId: item.runId, stepId: item.stepId, hash: card.hash, okable: card.okable, until: deps.now() + CARD_DAYS * 864e5, ts: out.ts || null, used: null, at: iso() });
    n += 1;
  }
  return n;
}

const ANSWERED = (what, at) => [{ type: 'section', text: { type: 'mrkdwn', text: what } }, { type: 'context', elements: [{ type: 'mrkdwn', text: `In Slack, ${at}` }] }];

// A button tap. Returns { ephemeral } to show only the tapper, or { replace } for the card's new blocks.
async function action(payload) {
  const a = (payload.actions || [])[0] || {};
  if (a.action_id === 'open') return null;
  const card = deps.db.get('hqSlackCards', String(a.value || ''));
  const d = card && deps.db.get('hqSlack', card.memberId);
  const owner = d && userOf(d);
  const team = payload.team && payload.team.id;
  const who = payload.user && payload.user.id;
  if (!card || !d || !owner) return { ephemeral: 'This card is no longer active. Open HQ to answer.' };
  if (d.team.id !== String(team) || !d.linked || d.linked.user !== String(who)) return { ephemeral: `Only ${firstName(owner)} can OK this.` };
  if (!on(owner)) return { ephemeral: 'HQ in Slack is off for this account right now.' };
  if (card.used) return { ephemeral: 'This card was already used.' };
  if (!card.okable) return { ephemeral: 'Open HQ to answer this one.' };
  const item = deps.db.get('inbox', card.itemId);
  if (!item || item.status !== 'open' || card.until < deps.now()) {
    card.used = 'expired';
    await deps.db.save('hqSlackCards', card);
    return { replace: ANSWERED('This card expired. Open HQ to see where it stands.', iso().slice(0, 16).replace('T', ' ')) };
  }
  // SL2: the step must still be exactly what the card showed.
  const now = cardFor(owner, item, card.id);
  if (!now || now.hash !== card.hash || !now.okable) {
    card.used = 'void';
    await deps.db.save('hqSlackCards', card);
    return { replace: ANSWERED('Something changed since this card was sent, so it no longer works. Open HQ to see it.', iso().slice(0, 16).replace('T', ' ')) };
  }
  card.used = a.action_id === 'ok' ? 'ok' : 'skip';
  await deps.db.save('hqSlackCards', card);
  const engine = deps.engine();
  const st = engine.get(owner, card.runId).steps[card.stepId];
  const spec = st.spec || {};
  const ans = a.action_id === 'ok' ? (spec.act && spec.items ? { chosen: spec.items.map((i) => i.key) } : {}) : { approved: false };
  try {
    await engine.answer(owner, card.runId, card.stepId, ans, { who: 'you', via: 'Slack' });
  } catch (err) {
    return { replace: ANSWERED(`HQ couldn't take that: ${err.message}`, iso().slice(0, 16).replace('T', ' ')) };
  }
  return { replace: ANSWERED(a.action_id === 'ok' ? `*OK'd:* ${clip(spec.title, 150)}` : `*Not now:* ${clip(spec.title, 150)}`, iso().slice(0, 16).replace('T', ' ')) };
}

// Slack's events: the URL check, and an uninstall or revoked token deletes what HQ keeps for that workspace.
async function events(body) {
  if (body && body.type === 'url_verification') return { challenge: String(body.challenge || '') };
  const e = (body && body.event) || {};
  if (body && body.type === 'event_callback' && (e.type === 'app_uninstalled' || e.type === 'tokens_revoked')) {
    for (const d of deps.db.filter('hqSlack', (x) => x.team.id === String(body.team_id))) await removeDoc(d);
  }
  return { ok: true };
}

// ---------- the pulse ----------

function footerText(f) {
  const base = deps.base();
  return `${f.why} <${base}${f.settings}|Settings> · <${base}${f.stop}|Stop these>`;
}

async function sendPulse(user, d, { force = false } = {}) {
  const nudges = deps.nudges();
  if (typeof nudges.sendable !== 'function') return 'off';
  const can = nudges.sendable(user, 'slack');
  if (!can.ok) return can.why;
  const posts = deps.posts();
  const posted = posts && typeof posts.counts === 'function' ? (u, day) => {
    const start = Date.parse(`${day}T05:00:00Z`);
    return posts.counts(u, { since: start, until: start + 864e5 });
  } : null;
  const p = await nudges.pulse(user, { channel: 'slack', shared: false, posted });
  if (!p) return 'empty';
  if (!force && d.lastPulse === p.day) return 'sent';
  const lines = p.lines.map((l) => `• ${l.text}`).join('\n');
  const blocks = [{ type: 'section', text: { type: 'mrkdwn', text: `*${p.label}*\n${lines}` } }];
  if (p.nextStep) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: p.nextStep.href ? `<${deps.base()}${p.nextStep.href}|${p.nextStep.text}>` : p.nextStep.text } });
  blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: footerText(p.footer) }] });
  await dm(d, { text: `${p.label}: ${p.lines.map((l) => l.text).join(' ')}`, blocks });
  d.lastPulse = p.day;
  await deps.db.save('hqSlack', d);
  return true;
}

let busy = false;
// Every minute (server.js): new OK cards, and the pulse once a day when the member has it on.
async function tick() {
  if (busy || flag() === 'off' || !ready()) return 0;
  busy = true;
  let n = 0;
  try {
    for (const d of deps.db.filter('hqSlack', (x) => x.linked)) {
      const user = userOf(d);
      if (!user || !on(user)) continue;
      try {
        n += await sendCards(user, d);
        if ((await sendPulse(user, d)) === true) n += 1;
      } catch (err) {
        console.warn('[slack] send', scrubKeys(String(err.message)));
      }
    }
  } finally {
    busy = false;
  }
  return n;
}

module.exports = { SCOPES, MONEY, SlackError, flag, on, ready, installUrl, finishInstall, newCode, setCards, disconnect, forget, status, verify, command, cardFor, sendCards, action, events, sendPulse, tick, hashOf, _setDeps };
