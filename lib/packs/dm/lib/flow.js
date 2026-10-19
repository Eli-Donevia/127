// The funnel's copy as a flat list of editable items (what the member reads and edits in the
// approval card), and back again. One source of truth: the guide, the JSON spec and the phone
// preview are all built from the approved items.

const { checkMessage, checkButton, checkPublicReply, LIMITS } = require('./limits');
const { FOLLOW_UP_HOURS } = require('./goals');

// copy (from write_flow) -> [{ key, label, text, limit }]
function toItems(goal, copy) {
  const items = [];
  (copy.publicReplies || []).forEach((t, i) => items.push({ key: `reply${i + 1}`, label: `Public reply ${i + 1}`, text: t, limit: LIMITS.publicReply }));
  if (copy.opening) {
    items.push({ key: 'opening', label: 'Opening DM', text: copy.opening.text, limit: LIMITS.withButtons });
    items.push({ key: 'openingButton', label: `Opening DM button (up to ${LIMITS.button} characters)`, text: copy.opening.button, limit: LIMITS.button });
  }
  if (copy.qualifier) {
    items.push({ key: 'question', label: 'Question before the calendar', text: copy.qualifier.text, limit: LIMITS.withButtons });
    (copy.qualifier.options || []).slice(0, 3).forEach((o, i) => items.push({ key: `answer${i + 1}`, label: `Answer button ${i + 1} (up to ${LIMITS.button} characters)`, text: o, limit: LIMITS.button }));
  }
  if (copy.emailAsk) items.push({ key: 'emailAsk', label: 'Email ask', text: copy.emailAsk.text, limit: LIMITS.withoutButtons });
  if (copy.linkMessage) {
    items.push({ key: 'link', label: goal === 'waitlist' && !copy.linkMessage.button ? 'Confirmation message' : 'Link message', text: copy.linkMessage.text, limit: copy.linkMessage.button ? LIMITS.withButtons : LIMITS.withoutButtons });
    if (copy.linkMessage.button) items.push({ key: 'linkButton', label: `Link button (up to ${LIMITS.button} characters)`, text: copy.linkMessage.button, limit: LIMITS.button });
  }
  if (copy.followUp) {
    items.push({ key: 'followUp', label: `Follow-up, about ${FOLLOW_UP_HOURS} hours later`, text: copy.followUp.text, limit: LIMITS.withButtons });
    if (copy.followUp.button) items.push({ key: 'followUpButton', label: `Follow-up button (up to ${LIMITS.button} characters)`, text: copy.followUp.button, limit: LIMITS.button });
  }
  return items;
}

const val = (items, key) => {
  const it = (items || []).find((x) => x && x.key === key);
  return it ? String(it.text == null ? '' : it.text).trim() : '';
};

// approved items -> the messages, in order, with buttons and checks. url: the tracked link.
function messagesFrom(goal, items, { url, keyword }) {
  const msgs = [];
  const replies = (items || []).filter((x) => /^reply\d$/.test(x.key)).map((x) => String(x.text || '').trim()).filter(Boolean);
  if (replies.length) msgs.push({ id: 'publicReplies', type: 'public_reply', title: 'Public replies', texts: replies, checks: replies.map(checkPublicReply) });
  if (val(items, 'opening')) {
    const b = val(items, 'openingButton') || 'Send it';
    msgs.push({ id: 'opening', type: 'message', title: 'Opening DM', text: val(items, 'opening'), buttons: [{ title: b, action: 'next' }], when: goal === 'story' ? '' : 'Sent as a private reply to their comment' });
  }
  if (val(items, 'question')) {
    const answers = ['answer1', 'answer2', 'answer3'].map((k) => val(items, k)).filter(Boolean);
    msgs.push({ id: 'question', type: 'message', title: 'Question', text: val(items, 'question'), buttons: answers.map((a) => ({ title: a, action: 'next' })), when: 'After they tap the button' });
  }
  if (val(items, 'emailAsk')) msgs.push({ id: 'emailAsk', type: 'email_ask', title: 'Email ask', text: val(items, 'emailAsk'), buttons: [], when: 'Collect emails step' });
  if (val(items, 'link')) {
    const b = val(items, 'linkButton');
    msgs.push({ id: 'link', type: 'message', title: goal === 'waitlist' && !b ? 'Confirmation' : 'Link message', text: val(items, 'link'), buttons: b ? [{ title: b, action: 'url', url }] : [], when: goal === 'story' ? `Right after they reply ${keyword}` : '' });
  }
  if (val(items, 'followUp')) {
    const b = val(items, 'followUpButton');
    msgs.push({ id: 'followUp', type: 'message', title: 'Follow-up', text: val(items, 'followUp'), buttons: b ? [{ title: b, action: 'url', url }] : [], delayHours: FOLLOW_UP_HOURS, when: `About ${FOLLOW_UP_HOURS} hours later, only to people who didn't open the link` });
  }
  for (const m of msgs) if (m.type !== 'public_reply') m.check = checkMessage({ text: m.text, buttons: (m.buttons || []).map((x) => x.title) });
  return msgs;
}

// Every problem across the funnel, as plain lines.
function problemsOf(msgs) {
  const out = [];
  for (const m of msgs) {
    if (m.type === 'public_reply') m.checks.forEach((c, i) => c.problems.forEach((p) => out.push(`Public reply ${i + 1}: ${p}`)));
    else if (m.check) m.check.problems.forEach((p) => out.push(`${m.title}: ${p}`));
  }
  return out;
}

module.exports = { toItems, messagesFrom, problemsOf, val, checkButton };
