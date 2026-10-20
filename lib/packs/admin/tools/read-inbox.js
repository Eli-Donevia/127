// Reads the email the member hands over: pasted messages, one .eml file, a ZIP of .eml files, or an
// .mbox export (Gmail's Google Takeout, Apple Mail, Thunderbird). Nothing connects to a mailbox.
// Message text stays in this run; nothing is kept.

const fs = require('fs');
const path = require('path');
const { views } = require('../../_kit');
const E = require('../lib/email');
const { assetText } = require('../lib/doc-text');

const MAX = 40;

module.exports = {
  name: 'admin.read_inbox',
  title: 'Read your email',
  description: 'Reads pasted emails, a ZIP of saved .eml files or an .mbox export, or a .txt, and lists each message with who sent it and the newest part of the thread. It never connects to your mailbox.',
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 0,
  input: {
    type: 'object',
    properties: {
      pasted: { type: 'string', title: 'Paste emails', format: 'textarea', maxLength: 40000 },
      file: { type: 'string', format: 'asset', title: 'Or a ZIP of saved emails (.eml or .mbox inside), or a .txt', accept: '.zip,.txt,application/zip,text/plain' },
    },
  },
  output: {
    type: 'object',
    properties: { messages: { type: 'array', items: { type: 'object' } }, count: { type: 'integer' }, more: { type: 'integer' }, sample: { type: 'boolean' } },
    required: ['messages', 'count'],
  },
  async run(input, ctx) {
    let messages = [];
    let sample = false;
    if (input.file) {
      const f = await assetText(ctx, input.file, { what: 'email file' });
      if (f.kind === 'zip') {
        const emls = f.files.filter((x) => /\.(eml|txt|mbox)$/i.test(x.name));
        if (!emls.length) throw new Error('This ZIP has no .eml files in it.');
        for (const x of emls.slice(0, 200)) messages.push(...E.readMessages(x.data.toString('utf8')));
      } else messages.push(...E.readMessages(f.text));
    }
    if (input.pasted && String(input.pasted).trim()) messages.push(...E.readMessages(input.pasted));
    if (!messages.length && !input.file && !(input.pasted && String(input.pasted).trim())) {
      messages = E.readMessages(fs.readFileSync(path.join(__dirname, '..', 'sample', 'inbox.mbox'), 'utf8'));
      sample = true;
    }
    if (!messages.length) throw new Error("Couldn't find any emails in that. Paste each one with its From and Subject lines, or save them as .eml files.");
    const more = Math.max(0, messages.length - MAX);
    messages = messages.slice(0, MAX).map((m, i) => ({ n: i + 1, ...m }));
    ctx.log(`Read ${messages.length} ${messages.length === 1 ? 'email' : 'emails'}${more ? ` (the first ${MAX}; ${more} more were left out)` : ''}`);
    return { messages, count: messages.length, ...(more ? { more } : {}), ...(sample ? { sample: true } : {}) };
  },
  view(out) {
    return views.blocks(
      views.sampleNote(out, 'These emails'),
      views.metric('Emails read', out.count, out.more ? `${out.more} more were left out: try 40 at a time` : 'Nothing was sent or changed'),
      views.table([{ key: 'fromName', label: 'From' }, { key: 'subject', label: 'Subject' }], out.messages, 12)
    );
  },
};
