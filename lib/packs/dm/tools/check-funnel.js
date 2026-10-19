// Checks a member's existing ManyChat funnel against ManyChat's limits and Instagram's messaging
// rules (data/platform.json, checked 2026-10-19), and says how to fix each problem. Pure code.

const { views, time } = require('../../_kit');
const platform = require('../data/platform.json');
const { check: checkKeyword, clean } = require('../lib/keywords');
const { LIMITS, checkMessage, checkPublicReply, fitButton } = require('../lib/limits');

const WINDOW = platform.meta.standardWindowHours;
const URGENT = /\b(only \d+ (left|spots?)|limited (time|spots?)|ends (tonight|today|soon)|hurry|act now|today only|last chance|before it'?s gone)\b/i;
const PROMISE = /\b(guarantee[ds]?|you will (make|earn|get \d)|results in \d+|double your|10x)\b/i;

function row(item, status, note, fix = '') {
  return { item, status, note, fix };
}

module.exports = {
  name: 'dm.check_funnel',
  title: 'Check your DM funnel',
  description: "Checks your ManyChat keyword, DMs, buttons, follow-up timing and public replies against ManyChat's limits and Instagram's 24 hour rule, with a fix for each problem.",
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 1,
  input: {
    type: 'object',
    properties: {
      keyword: { type: 'string', title: 'Keyword', maxLength: 30 },
      opening: { type: 'string', title: 'Opening DM', maxLength: 1200 },
      openingButton: { type: 'string', title: 'Opening DM button', maxLength: 60 },
      link: { type: 'string', title: 'Link message', maxLength: 1200 },
      linkButton: { type: 'string', title: 'Link button', maxLength: 60 },
      followUp: { type: 'string', title: 'Follow-up', maxLength: 1200 },
      followUpHours: { type: 'number', title: 'Follow-up delay (hours)', minimum: 0, maximum: 720 },
      publicReplies: { type: 'string', title: 'Public replies', maxLength: 1500 },
    },
    required: ['keyword'],
  },
  output: {
    type: 'object',
    properties: { rows: { type: 'array' }, fixes: { type: 'integer' }, warnings: { type: 'integer' } },
    required: ['rows', 'fixes'],
  },
  async run(input) {
    const rows = [];
    // Keyword
    const raw = String(input.keyword || '').trim();
    const k = checkKeyword(raw, 'freebie');
    if (/\s/.test(raw)) rows.push(row('Keyword', 'fix', `"${raw}" has a space. People type one word in comments.`, `Use one word, like ${clean(raw.split(/\s+/)[0]) || 'GUIDE'}.`));
    else if (k.notes.some((n) => /Common word/.test(n))) rows.push(row('Keyword', 'fix', `${k.keyword} is a word people type in everyday comments, so it will fire by accident.`, 'Pick a word tied to what you send, like the name of the freebie.'));
    else if (k.keyword.length > 10) rows.push(row('Keyword', 'warn', `${k.keyword} is ${k.keyword.length} letters. Long words get misspelled on phones.`, 'Aim for 4 to 8 letters.'));
    else rows.push(row('Keyword', 'ok', `${k.keyword} is short and specific.`));

    // Opening DM
    if (input.opening) {
      const c = checkMessage({ text: input.opening, buttons: input.openingButton ? [input.openingButton] : [] });
      if (!input.openingButton) rows.push(row('Opening DM', 'fix', 'No button. Instagram lets you send one message to a commenter until they respond.', 'Add a button (like "Send it"). The tap counts as their response and opens the 24 hour window for the rest.'));
      if (/https?:\/\/|www\./i.test(input.opening)) rows.push(row('Opening DM', 'warn', 'The link is in the first message. People who tap it never respond, so you cannot follow up.', 'Move the link to the message after the button tap.'));
      c.problems.forEach((p) => rows.push(row('Opening DM', 'fix', p, 'Shorten it. Under 300 characters reads best on a phone.')));
      if (c.ok && input.openingButton) rows.push(row('Opening DM', 'ok', `${c.count} of ${c.limit} characters, with a button.`));
    } else rows.push(row('Opening DM', 'warn', 'Not pasted, so not checked.'));
    if (input.openingButton && input.openingButton.length > LIMITS.button) rows.push(row('Opening DM button', 'fix', `"${input.openingButton}" is ${input.openingButton.length} characters. ManyChat allows ${LIMITS.button}.`, `Try "${fitButton(input.openingButton)}".`));

    // Link message
    if (input.link) {
      const c = checkMessage({ text: input.link, buttons: input.linkButton ? [input.linkButton] : [] });
      c.problems.forEach((p) => rows.push(row('Link message', 'fix', p, 'Shorten it.')));
      if (!input.linkButton && /https?:\/\/|www\./i.test(input.link)) rows.push(row('Link message', 'warn', 'The link is pasted in the text.', 'Use a link button instead: it looks cleaner and ManyChat counts the clicks.'));
      if (c.ok) rows.push(row('Link message', 'ok', `${c.count} of ${c.limit} characters.`));
    }
    if (input.linkButton && input.linkButton.length > LIMITS.button) rows.push(row('Link button', 'fix', `"${input.linkButton}" is ${input.linkButton.length} characters. ManyChat allows ${LIMITS.button}.`, `Try "${fitButton(input.linkButton)}".`));

    // Follow-up
    const h = input.followUpHours;
    if (input.followUp || h != null) {
      if (h != null && h >= WINDOW) rows.push(row('Follow-up timing', 'fix', `${h} hours is outside Instagram's ${WINDOW} hour window, so it won't be delivered.`, 'Set the delay to about 20 hours.'));
      else if (h != null && h >= WINDOW - 1) rows.push(row('Follow-up timing', 'warn', `${h} hours cuts it close to the ${WINDOW} hour window.`, 'Set it to about 20 hours to leave room.'));
      else if (h != null && h < 2) rows.push(row('Follow-up timing', 'warn', `${h} hours is soon. People who saw the DM may not have had time to open it.`, 'Try 12 to 20 hours.'));
      else if (h != null) rows.push(row('Follow-up timing', 'ok', `${h} hours lands inside the ${WINDOW} hour window.`));
      if (input.followUp) {
        const c = checkMessage({ text: input.followUp, buttons: ['x'] });
        c.problems.forEach((p) => rows.push(row('Follow-up', 'fix', p, 'Shorten it.')));
      }
    } else rows.push(row('Follow-up', 'warn', 'No follow-up. Some people miss the first DM.', `Add one about 20 hours later, only to people who didn't open the link.`));

    // Public replies
    const replies = String(input.publicReplies || '').split('\n').map((s) => s.trim()).filter(Boolean);
    if (!replies.length) rows.push(row('Public replies', 'warn', 'None pasted.', 'Write at least 3 so ManyChat can rotate them and they never look copied.'));
    else {
      if (replies.length < 3) rows.push(row('Public replies', 'warn', `Only ${replies.length}. The same reply under every comment looks automated.`, 'Write 3 to 5 different ones.'));
      if (new Set(replies.map((r) => r.toLowerCase())).size < replies.length) rows.push(row('Public replies', 'warn', 'Some replies are the same.', 'Make each one different.'));
      replies.forEach((r, i) => checkPublicReply(r).problems.forEach((p) => rows.push(row(`Public reply ${i + 1}`, 'fix', p, 'Keep it short and keep links in the DM.'))));
      if (rows.every((x) => !/^Public repl/.test(x.item) || x.status === 'ok')) rows.push(row('Public replies', 'ok', `${replies.length} different replies, short and link-free.`));
    }

    // Copy that can backfire
    const all = [input.opening, input.link, input.followUp, ...replies].filter(Boolean).join('\n');
    if (URGENT.test(all)) rows.push(row('Urgency', 'warn', 'One of your messages pushes people to hurry.', 'Keep it only if it is true (a real date or a real count). Otherwise cut it.'));
    if (PROMISE.test(all)) rows.push(row('Promises', 'warn', "One of your messages promises a result you don't control.", 'Promise what you control: what they get, when, and your redo or refund.'));
    if (/\{\{\s*\w+\s*\}\}/.test(all) || /first_name/i.test(all)) rows.push(row('Personal fields', 'warn', 'Instagram profiles often have no first name, so a name field can come out blank.', 'Write it so it reads fine without the name.'));

    const fixes = rows.filter((r) => r.status === 'fix').length;
    const warnings = rows.filter((r) => r.status === 'warn').length;
    return { rows, fixes, warnings, checked: platform.checked };
  },
  view(out) {
    const label = { fix: 'Fix', warn: 'Check', ok: 'Good' };
    return views.blocks(
      views.metric('To fix', out.fixes, out.warnings ? `${out.warnings} more to check` : 'Nothing else to check'),
      views.table(
        [
          { key: 'item', label: 'Part' },
          { key: 'status', label: 'Status' },
          { key: 'note', label: 'What we found' },
          { key: 'fix', label: 'What to change' },
        ],
        out.rows.map((r) => ({ ...r, status: label[r.status] || r.status })),
        20
      ),
      views.text(`Checked against ManyChat's limits and Instagram's messaging rules as of ${time.longDate(out.checked)}.`)
    );
  },
};
