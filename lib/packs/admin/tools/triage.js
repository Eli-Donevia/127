// Sorts the emails into reply today, reply this week, FYI and ignore, says why for each, and drafts
// a reply for every "reply today" one. AI sorts and drafts when it is on; the rules in lib/triage.js
// do both when it is off. Drafts leave [brackets] for what only the member knows (prices, times,
// what they will do). Nothing is sent, labeled or moved in any mailbox.

const { views, save, ai, text, time, brain } = require('../../_kit');
const T = require('../lib/triage');
const { page, esc, DRAFT_NOTE } = require('../lib/page');

const SORT = {
  type: 'object',
  properties: { items: { type: 'array', items: { type: 'object', properties: { n: { type: 'integer' }, bucket: { type: 'string', enum: T.BUCKETS }, why: { type: 'string', maxLength: 160 } }, required: ['n', 'bucket', 'why'] } } },
  required: ['items'],
};
const DRAFTS = {
  type: 'object',
  properties: { replies: { type: 'array', items: { type: 'object', properties: { n: { type: 'integer' }, body: { type: 'string', maxLength: 2000 } }, required: ['n', 'body'] } } },
  required: ['replies'],
};

const brief = (m) => `#${m.n} From: ${m.fromName || ''} <${m.from || 'unknown'}>\nSubject: ${m.subject}\nDate: ${m.date || ''}\n${text.clip(m.body, 1200)}`;

module.exports = {
  name: 'admin.triage',
  title: 'Sort and draft replies',
  description: 'Sorts your emails into reply today, reply this week, FYI and ignore, with the reason for each, and drafts a reply for each one that needs an answer today. Nothing is sent.',
  kind: 'ai',
  risk: 'draft',
  needs: [],
  tasks: ['classify', 'write'],
  credits: 3,
  timeoutSec: 120,
  input: {
    type: 'object',
    properties: {
      messages: { type: 'array', items: { type: 'object' }, title: 'Emails' },
      sample: { type: 'boolean' },
    },
    required: ['messages'],
  },
  output: {
    type: 'object',
    properties: {
      items: { type: 'array', items: { type: 'object' } },
      counts: { type: 'object' },
      drafts: { type: 'array', items: { type: 'object' } },
      page: { type: 'object' },
      ai: { type: 'boolean' },
      sample: { type: 'boolean' },
    },
    required: ['items', 'counts', 'drafts'],
  },
  async run(input, ctx) {
    const b = brain.brainOf(ctx, input);
    const today = time.today(ctx);
    const messages = (input.messages || []).slice(0, 40).map((m, i) => ({ ...m, n: i + 1, subject: String(m.subject || '(no subject)'), body: String(m.body || '') }));
    if (!messages.length) throw new Error('No emails to sort.');
    const rules = messages.map((m) => T.classifyByRules(m, { today }));
    const sorted = await ai.aiJson(ctx, {
      task: 'classify',
      system: `You sort a small business owner's email. reply today: a customer or client with a problem, a complaint, something time-sensitive, or a question about money or a booking soon. week: a real person asking something that can wait a few days. fyi: receipts, notices, newsletters, updates with nothing to answer. ignore: ads, promotions and cold sales pitches. Give a short reason in plain words. Today is ${today}.`,
      prompt: `${b.name ? `Business: ${b.name}${b.what ? ` (${b.what})` : ''}\n\n` : ''}${messages.map(brief).join('\n\n---\n\n')}`,
      schema: SORT,
      maxTokens: 1800,
      fallback: () => ({ items: messages.map((m, i) => ({ n: m.n, bucket: rules[i].bucket, why: rules[i].why })) }),
      accept: (d) => messages.every((m) => d.items.some((x) => x.n === m.n)),
    });
    const items = messages.map((m, i) => {
      const s = sorted.data.items.find((x) => x.n === m.n) || { bucket: rules[i].bucket, why: rules[i].why };
      return { n: m.n, from: m.from, fromName: m.fromName || m.from, subject: m.subject, bucket: s.bucket, label: T.LABELS[s.bucket], why: text.clip(s.why, 160) };
    });
    const order = (x) => T.BUCKETS.indexOf(x.bucket);
    items.sort((a, c) => order(a) - order(c) || a.n - c.n);
    const todayOnes = items.filter((x) => x.bucket === 'today').slice(0, 8).map((x) => messages.find((m) => m.n === x.n));
    const me = b.firstName || '';
    const templates = todayOnes.map((m) => ({ n: m.n, ...T.templateReply(m, { me, business: b.name }) }));
    let draftsAi = false;
    let drafts = templates;
    if (todayOnes.length) {
      const res = await ai.aiJson(ctx, {
        task: 'write',
        system: `Draft short email replies for a small business owner to review and send themselves. Warm, plain and brief. Answer what was asked only when the answer is in the email; otherwise put what the owner must fill in inside [square brackets], like [price] or [day and time]. Never promise a refund, discount, date, price or outcome the owner has not stated. Never admit legal fault. Sign off with: ${[me || '[Your name]', b.name].filter(Boolean).join(', ')}.`,
        prompt: todayOnes.map(brief).join('\n\n---\n\n'),
        schema: DRAFTS,
        maxTokens: 2500,
        fallback: () => ({ replies: templates.map((t) => ({ n: t.n, body: t.body })) }),
        accept: (d) => todayOnes.every((m) => d.replies.some((r) => r.n === m.n && r.body.length > 20)) && ai.cleanCopy(d.replies.map((r) => r.body)) && !d.replies.some((r) => /\b(refund(ed)? (you|in full)|we('ll| will) (cover|pay for)|it was our fault|we are liable|free of charge)\b/i.test(r.body)),
      });
      draftsAi = res.ai;
      drafts = templates.map((t) => ({ ...t, body: (res.data.replies.find((r) => r.n === t.n) || t).body }));
    }
    drafts = drafts.map((d) => ({ n: d.n, to: d.to, subject: d.subject, body: d.body }));
    const counts = Object.fromEntries(T.BUCKETS.map((k) => [k, items.filter((x) => x.bucket === k).length]));
    const section = (k) => {
      const list = items.filter((x) => x.bucket === k);
      if (!list.length) return '';
      return `<h2>${esc(T.LABELS[k])} (${list.length})</h2>${list.map((x) => {
        const d = drafts.find((y) => y.n === x.n);
        return `<div class="card"><b>${esc(x.fromName)}</b>: ${esc(x.subject)}<br><span class="muted">${esc(x.why)}</span>${d ? `<h3>Draft reply</h3><pre>${esc(d.body)}</pre>` : ''}</div>`;
      }).join('')}`;
    };
    const file = await save.saveFile(ctx, save.fileName('inbox', today, '.html'), page({ title: 'Your inbox, sorted', kicker: time.longDate(today), lede: `${counts.today} to answer today, ${counts.week} this week, ${counts.fyi} FYI, ${counts.ignore} to ignore.`, body: `${T.BUCKETS.map(section).join('')}`, footer: DRAFT_NOTE }));
    ctx.log(`Sorted ${items.length} emails: ${counts.today} today, ${counts.week} this week${sorted.ai ? '' : ' (by rules)'}`);
    return { items, counts, drafts, page: file, ai: sorted.ai || draftsAi, ...(input.sample ? { sample: true } : {}) };
  },
  view(out) {
    return views.blocks(
      views.sampleNote(out, 'These emails'),
      views.metric('Reply today', out.counts.today, `${out.counts.week} this week, ${out.counts.fyi} FYI, ${out.counts.ignore} to ignore`),
      views.table([{ key: 'label', label: 'Pile' }, { key: 'fromName', label: 'From' }, { key: 'subject', label: 'Subject' }, { key: 'why', label: 'Why' }], out.items),
      ...out.drafts.map((d) => views.copy(`Draft reply: ${d.subject}`, d.body, { ...(d.to ? { to: d.to } : {}), subject: d.subject })),
      views.text(DRAFT_NOTE),
      views.file(out.page, 'Sorted inbox with drafts')
    );
  },
};
