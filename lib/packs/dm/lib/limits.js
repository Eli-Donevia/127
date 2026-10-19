// ManyChat's Instagram limits (data/platform.json, checked 2026-10-19): button names up to 20
// characters, 640 characters in a message with buttons, 1,000 without, 3 buttons per message.
// Checks copy against them and shortens button names on a word boundary when a draft runs long.

const platform = require('../data/platform.json');
const { text } = require('../../_kit');

const L = platform.manychat.limits;
const LIMITS = {
  button: L.buttonTitle,
  buttons: L.buttonsPerMessage,
  withButtons: L.textWithButtons,
  withoutButtons: L.textWithoutButtons,
  quickReply: L.quickReplyTitle,
  // Public replies under a comment: ManyChat doesn't publish a separate limit, and long public
  // replies read like ads. Our own house limit, not a platform rule.
  publicReply: 150,
};

const count = (s) => String(s == null ? '' : s).length;

// A button name that fits: keeps whole words, drops trailing filler, never ends in a comma.
function fitButton(label, max = LIMITS.button) {
  const t = text.oneLine(label).replace(/[.!]+$/, '');
  if (t.length <= max) return t;
  const words = t.split(' ');
  let out = '';
  for (const w of words) {
    const next = out ? `${out} ${w}` : w;
    if (next.length > max) break;
    out = next;
  }
  out = out.replace(/\s+(the|a|an|my|your|to|for|of|and|with)$/i, '').replace(/[,:;]+$/, '');
  return out || t.slice(0, max).trim();
}

// One message: { text, buttons: [label...] }. Returns { ok, count, limit, problems }.
function checkMessage(msg = {}) {
  const buttons = (msg.buttons || []).filter(Boolean);
  const limit = buttons.length ? LIMITS.withButtons : LIMITS.withoutButtons;
  const n = count(msg.text);
  const problems = [];
  if (!String(msg.text || '').trim()) problems.push('The message is empty.');
  if (n > limit) problems.push(`${n - limit} characters over ManyChat's ${limit} character limit${buttons.length ? ' for a message with buttons' : ''}.`);
  if (buttons.length > LIMITS.buttons) problems.push(`Instagram messages take up to ${LIMITS.buttons} buttons.`);
  for (const b of buttons) {
    if (count(b) > LIMITS.button) problems.push(`Button "${b}" is ${count(b)} characters. ManyChat allows ${LIMITS.button}.`);
  }
  return { ok: problems.length === 0, count: n, limit, problems };
}

function checkButton(label) {
  const n = count(label);
  return { ok: n > 0 && n <= LIMITS.button, count: n, limit: LIMITS.button };
}

function checkPublicReply(s) {
  const n = count(s);
  const problems = [];
  if (!String(s || '').trim()) problems.push('Empty reply.');
  if (n > LIMITS.publicReply) problems.push(`Long for a public reply (${n} characters). Keep it under ${LIMITS.publicReply} so it reads like a person.`);
  if (/https?:\/\/|www\./i.test(s)) problems.push('Links in public replies look like spam. Keep the link in the DM.');
  return { ok: problems.length === 0, count: n, limit: LIMITS.publicReply, problems };
}

module.exports = { LIMITS, count, fitButton, checkMessage, checkButton, checkPublicReply };
