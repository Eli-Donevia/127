// A contract checklist: what to look for in this kind of contract, which items the text seems to
// cover, which it seems to miss, and wording a lawyer should look at. Follows Legal row 9 (C3): it
// names facts and topics and says to ask a lawyer about legal terms; it never writes, changes or
// recommends terms or says whether anything is legal or enforceable. Pattern checks only, no AI:
// the contract text is not sent anywhere and is not kept.

const fs = require('fs');
const path = require('path');
const { views, save, text } = require('../../_kit');
const C = require('../lib/contracts');
const { assetText } = require('../lib/doc-text');
const { page, esc } = require('../lib/page');

const TYPES = Object.keys(C.DATA.types);

module.exports = {
  name: 'admin.contract_check',
  title: 'Check a contract',
  description: 'Lists what to look for in a contract, marks which items the text seems to cover or miss, and points out wording to ask a lawyer about. A checklist, not legal advice.',
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 0,
  input: {
    type: 'object',
    properties: {
      contract: { type: 'string', title: 'Paste the contract', format: 'textarea', maxLength: 60000 },
      file: { type: 'string', format: 'asset', title: 'Or add it as a Word or text file', accept: '.docx,.txt,.md,.html,.htm' },
      type: { type: 'string', title: 'What kind', enum: ['auto', ...TYPES], default: 'auto' },
    },
  },
  output: {
    type: 'object',
    properties: {
      type: { type: 'string' },
      typeTitle: { type: 'string' },
      items: { type: 'array', items: { type: 'object' } },
      missing: { type: 'integer' },
      risks: { type: 'array', items: { type: 'object' } },
      questions: { type: 'array', items: { type: 'string' } },
      disclaimer: { type: 'string' },
      checklist: { type: 'object' },
      sample: { type: 'boolean' },
    },
    required: ['type', 'items', 'risks', 'questions', 'disclaimer'],
  },
  async run(input, ctx) {
    let body = String(input.contract || '');
    let sample = false;
    if (input.file) body = `${body}\n${(await assetText(ctx, input.file, { what: 'contract' })).text || ''}`;
    if (!body.trim()) {
      body = fs.readFileSync(path.join(__dirname, '..', 'sample', 'contract.txt'), 'utf8');
      sample = true;
    }
    const r = C.check(body, { type: input.type && input.type !== 'auto' ? input.type : undefined });
    const items = r.items.map((i) => ({ label: i.label, status: i.found == null ? 'Check' : i.found ? 'Found' : 'Not found', why: i.legal ? `${i.why} ${C.DATA.lawyer}` : i.why }));
    const html = page({
      title: 'Contract checklist',
      kicker: r.typeTitle,
      lede: r.read ? `Read ${r.words} words. ${r.missing.length} items not found, ${r.risks.length} parts to ask a lawyer about or note.` : 'No contract text was added, so this is the list of what to look for.',
      body: `<div class="card warn"><b>Not legal advice.</b> ${esc(r.disclaimer)}</div>
<h2>What to look for</h2><table><tr><th></th><th>Item</th><th>What it covers</th></tr>${items.map((i) => `<tr><td class="${i.status === 'Found' ? 'ok' : 'miss'}">${esc(i.status)}</td><td>${esc(i.label)}</td><td>${esc(i.why)}</td></tr>`).join('')}</table>
${r.risks.length ? `<h2>Wording to look at</h2>${r.risks.map((x) => `<div class="card"><b>${esc(x.label)}</b><p class="muted">"${esc(x.quote)}"</p>${esc(x.why)}</div>`).join('')}` : ''}
<h2>Questions to take to your lawyer</h2><ol>${r.questions.map((q) => `<li>${esc(q)}</li>`).join('')}</ol>
<p class="muted">Find a lawyer referral service: ${esc(r.referral)}</p>`,
      footer: 'A checklist, not legal advice. The contract text was read for this checklist only and was not kept.',
    });
    const checklist = await save.saveFile(ctx, save.fileName('contract-checklist', text.slug(r.type, 20), '.html'), html);
    ctx.log(`Checked ${r.words} words as ${r.typeTitle.toLowerCase()}: ${r.missing.length} not found, ${r.risks.length} to look at`);
    return { type: r.type, typeTitle: r.typeTitle, items, missing: r.missing.length, risks: r.risks.map((x) => ({ label: x.label, quote: x.quote, why: x.why })), questions: r.questions, disclaimer: r.disclaimer, checklist, ...(sample ? { sample: true } : {}) };
  },
  view(out) {
    return views.blocks(
      views.sampleNote(out, 'This contract'),
      views.text(`Not legal advice. ${out.disclaimer}`),
      views.metric('Items not found', out.missing, `${out.typeTitle}: ${out.risks.length} parts to look at`),
      views.table([{ key: 'status', label: '' }, { key: 'label', label: 'Item' }, { key: 'why', label: 'What it covers' }], out.items),
      out.risks.length ? views.table([{ key: 'label', label: 'Wording' }, { key: 'quote', label: 'Where' }, { key: 'why', label: 'Note' }], out.risks) : null,
      views.file(out.checklist, 'Checklist to take to your lawyer')
    );
  },
};
