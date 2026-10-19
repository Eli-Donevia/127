// The reply bank as files the member keeps open: a printable sheet in their colors (each reply in a
// copy block with a short shortcut word for Instagram saved replies), a CSV for Sheets or Notes, and
// setup steps for the 4 ManyChat keyword auto-replies.

const { views, save, files, text, time, brain } = require('../../_kit');
const platform = require('../data/platform.json');
const { paletteFor } = require('../lib/palette');
const { css } = require('../lib/guide');
const { LIMITS } = require('../lib/limits');

const esc = files.esc;

function sheetHtml({ b, replies, autos, link, p, today }) {
  const block = (r) => `<div class="step"><div class="copy"><div class="copy-top"><span>${esc(r.situation || r.label)}</span>${r.shortcut ? `<span class="count">shortcut: ${esc(r.shortcut)}</span>` : ''}</div><div class="msg">${esc(r.text)}</div></div></div>`;
  const auto = (a) =>
    `<div class="step"><div class="step-top"><div class="step-n">${esc(a.keyword)}</div><div><h3>When someone DMs ${esc(a.keyword.toLowerCase())}</h3><p class="muted">Keywords trigger, "${esc(platform.manychat.keywordTrigger.matching[2])}": ${esc(a.keyword)}</p></div></div><div class="copy"><div class="copy-top"><span>Reply</span><span class="count${a.text.length > (a.button ? LIMITS.withButtons : LIMITS.withoutButtons) ? ' over' : ''}">${a.text.length} / ${a.button ? LIMITS.withButtons : LIMITS.withoutButtons}</span></div><div class="msg">${esc(a.text)}</div></div>${a.button ? `<div class="btn-row"><span class="btn">${esc(a.button)} <small>${a.button.length}/${LIMITS.button}, link button</small></span></div>${link ? `<div class="url">${esc(link)}</div>` : ''}` : ''}</div>`;
  const body = `<header class="hero"><div class="wrap"><div class="kicker">DM answers${b.name ? ` for ${esc(b.name)}` : ''}</div><h1>Answer every DM in seconds</h1><p class="lede">${replies.length} replies to the questions people send most, plus ${autos.length} answers ManyChat can send for you.</p><div class="chips"><span class="chip"><b>${replies.length}</b> replies</span><span class="chip"><b>${autos.length}</b> auto-replies</span></div></div></header>
<section><div class="wrap"><div class="sec-head"><span class="sec-num">01</span><h2>Save them where you type</h2></div>
<ul class="checks"><li><span class="box"></span><div><b>Instagram saved replies.</b> Professional accounts can save replies with a shortcut word and drop them into any chat. Look for Saved replies in your business tools settings (the menu name changes between app versions). Use the shortcut next to each reply.</div></li>
<li><span class="box"></span><div><b>Or your phone's notes.</b> The CSV in your Library opens in Sheets, Excel or Numbers.</div></li>
<li><span class="box"></span><div><b>Fill the [brackets]</b> with your real details before you save a reply. Never send a bracket.</div></li></ul></div></section>
<section><div class="wrap"><div class="sec-head"><span class="sec-num">02</span><h2>Your replies</h2></div>${replies.map(block).join('\n')}</div></section>
<section><div class="wrap"><div class="sec-head"><span class="sec-num">03</span><h2>Let ManyChat answer these</h2></div>
<p>In ManyChat, make one automation per keyword: Automations, new automation, Instagram keywords trigger. ${esc(platform.manychat.keywordTrigger.note)} These answer inside Instagram's ${platform.meta.standardWindowHours} hour window, because the person just messaged you.</p>
${autos.map(auto).join('\n')}</div></section>
<footer><div class="wrap"><p class="muted">Made ${esc(time.longDate(today))}. ManyChat facts checked ${esc(time.longDate(platform.checked))}: ${esc(platform.manychat.keywordTrigger.source)}</p></div></footer>`;
  return files.htmlDoc({ title: `${b.name || 'Your'} DM answers`, css: css(p), body });
}

module.exports = {
  name: 'dm.reply_sheet',
  title: 'Make your reply sheet',
  description: 'Turns your approved DM replies into a printable sheet with shortcut words for Instagram saved replies, a CSV, and setup steps for ManyChat keyword auto-replies.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  input: {
    type: 'object',
    properties: {
      items: { type: 'array', title: 'Approved replies', items: { type: 'object' } },
      link: { type: 'string', title: 'Main link', maxLength: 500 },
      color: { type: 'string', title: 'Brand color (optional)', maxLength: 9 },
    },
    required: ['items'],
  },
  output: {
    type: 'object',
    properties: { sheet: { type: 'object' }, csv: { type: 'object' }, count: { type: 'integer' }, unfilled: { type: 'integer' } },
    required: ['sheet', 'csv', 'count'],
  },
  async run(input, ctx) {
    const b = brain.brainOf(ctx, {});
    const items = (input.items || []).filter((x) => x && typeof x === 'object' && String(x.text || '').trim());
    const replies = items.filter((x) => !x.keyword).map((x) => ({ ...x, text: text.plain(x.text) }));
    const autos = items.filter((x) => x.keyword).map((x) => ({ ...x, text: text.plain(x.text) }));
    const p = paletteFor(ctx, { color: input.color });
    const today = time.today(ctx);
    const link = String(input.link || '').trim();
    const base = save.fileName(b.name || 'my', 'dm-replies');
    const sheet = await save.saveFile(ctx, `${base}.html`, sheetHtml({ b, replies, autos, link, p, today }), 'text/html');
    const rows = [
      ...replies.map((r) => ({ type: 'Saved reply', when: r.situation || r.label, shortcut: r.shortcut || '', reply: r.text, button: '' })),
      ...autos.map((a) => ({ type: 'ManyChat auto-reply', when: `They DM ${a.keyword}`, shortcut: a.keyword, reply: a.text, button: a.button || '' })),
    ];
    const csv = await save.saveFile(ctx, `${base}.csv`, files.csv(rows, [{ key: 'type', label: 'Type' }, { key: 'when', label: 'When' }, { key: 'shortcut', label: 'Shortcut or keyword' }, { key: 'reply', label: 'Reply' }, { key: 'button', label: 'Button' }], { bom: true }), 'text/csv');
    const unfilled = items.filter((x) => /\[[^\]]+\]/.test(x.text)).length;
    return { sheet, csv, count: items.length, unfilled, autos: autos.map((a) => ({ keyword: a.keyword, text: a.text, button: a.button || '' })) };
  },
  view(out) {
    return views.blocks(
      views.metric('Replies ready', out.count, out.unfilled ? `${out.unfilled} still have a [bracket] to fill` : 'Ready to save'),
      views.file(out.sheet, 'Reply sheet (print or keep open)'),
      views.file(out.csv, 'Replies as CSV'),
      ...out.autos.map((a) => views.copy(`ManyChat auto-reply for ${a.keyword}`, a.text))
    );
  },
};
