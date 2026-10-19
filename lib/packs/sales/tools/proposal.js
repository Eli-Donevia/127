// sales.proposal: a proposal from the prospect's real facts (their site, read by sales.read_prospect,
// and the member's notes) with three options, the most complete first. Printable HTML in the
// member's colors, plus the cover email and a text. AI writes the words when it's on; the facts
// and prices never come from AI.

const { text, time, views, save, ai } = require('../../_kit');
const { factsOf, settingsPatch } = require('../lib/facts');
const memory = require('../lib/memory');
const options = require('../lib/options');
const proposal = require('../lib/proposal');
const pipeline = require('../lib/pipeline');
const { ASSET } = require('../lib/money-run');

const NO_FILLER = (v) => ai.cleanCopy(v) && !/\[[^\]]*\]|\{[^}]*\}|lorem|sample text/i.test(JSON.stringify(v));

module.exports = {
  name: 'sales.proposal',
  title: 'Write a proposal',
  description: 'Writes a printable proposal from what the prospect told you and what their own site shows: up to three options with the most complete first, how it works, what is not included, your promise (when you made one) and a block to accept, plus the cover email.',
  kind: 'ai',
  tasks: ['write'],
  risk: 'draft',
  needs: [],
  credits: 6,
  timeoutSec: 90,
  input: {
    type: 'object',
    properties: {
      name: { type: 'string', maxLength: 80, title: 'Their name' },
      company: { type: 'string', maxLength: 80, title: 'Their business (optional)' },
      email: { type: 'string', maxLength: 120, title: 'Their email (optional)' },
      phone: { type: 'string', maxLength: 40, title: 'Their phone (optional)' },
      notes: { type: 'string', maxLength: 4000, title: 'What they told you (optional)' },
      goals: { type: 'string', maxLength: 1000, title: 'What they want, one per line (optional)' },
      title: { type: 'string', maxLength: 100, title: 'Proposal title (optional)' },
      prospect: { type: 'object', title: 'Facts from sales.read_prospect' },
      options: { type: 'array', title: 'Your options', items: { type: 'object', properties: { name: { type: 'string' }, price: { type: 'number' }, unit: { type: 'string' }, summary: { type: 'string' }, includes: { type: 'array', items: { type: 'string' } } } } },
      optionsText: { type: 'string', maxLength: 3000, title: 'Your options, one per line (optional)', description: 'Like "Complete, 1500, everything in Standard; monthly care plan". Leave empty to build three from your main price.' },
      price: { type: 'number', title: 'Your main price (optional)', description: 'Used to build the three options when you give none' },
      deposit: { type: ['number', 'string'], title: 'Deposit', description: '"50%" or "$500"' },
      payWhen: { type: 'string', enum: ['When the work is done', 'When they book', 'Each month, in advance'], default: 'When the work is done', title: 'With no deposit, they pay', description: 'Coaching and packages are often paid when they book; a monthly service each month in advance' },
      promise: { type: 'string', maxLength: 300, title: 'Your promise (optional)', description: 'What you promise every client, in your words. Left empty, your saved promise; with none, the proposal makes no promise and the run suggests one' },
      what: { type: 'string', maxLength: 120, title: 'What you do (optional)', description: 'Like "Business photography". Picks the right words for how it works and what is included' },
      taxRate: { type: ['number', 'string'], title: 'Sales tax rate' },
      payLink: { type: 'string', maxLength: 300, title: 'Your payment link' },
      payNote: { type: 'string', maxLength: 300, title: 'Other ways to pay' },
      contact: { type: 'string', maxLength: 200, title: 'Your contact line' },
      color: { type: 'string', maxLength: 7, title: 'Brand color hex' },
      terms: { type: 'string', maxLength: 1200, title: 'Your terms' },
      validDays: { type: 'integer', minimum: 1, maximum: 90, default: 14, title: 'Days the proposal holds' },
      number: { type: 'string', maxLength: 30 },
      remember: { type: 'boolean', default: true },
      pipeline: { type: 'boolean', default: true, title: 'Add them to my Pipeline', description: 'Off when the workflow that calls it already logs them' },
    },
  },
  output: {
    type: 'object',
    required: ['number', 'options', 'files'],
    properties: {
      number: { type: 'string' },
      date: { type: 'string' },
      validUntil: { type: 'string' },
      title: { type: 'string' },
      prospect: { type: 'object', properties: { name: { type: 'string' }, company: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, website: { type: 'string' } } },
      options: { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, name: { type: 'string' }, price: { type: 'number' }, unit: { type: 'string' }, per: { type: 'string' }, priceText: { type: 'string' }, summary: { type: 'string' }, includes: { type: 'array', items: { type: 'string' } }, recommended: { type: 'boolean' } } } },
      built: { type: 'boolean' },
      depositRate: { type: 'number' },
      heard: { type: 'array', items: { type: 'string' } },
      noticed: { type: 'array', items: { type: 'string' } },
      files: { type: 'object', properties: { html: ASSET } },
      message: { type: 'object', properties: { subject: { type: 'string' }, email: { type: 'string' }, text: { type: 'string' } } },
      warnings: { type: 'array', items: { type: 'string' } },
      ai: { type: 'boolean' },
    },
  },
  async run(input, ctx) {
    const f = factsOf(ctx, input);
    const p = input.prospect && typeof input.prospect === 'object' ? input.prospect : null;
    const warnings = [];
    const { options: opts, built } = options.threeOptions({ given: input.options, typed: input.optionsText, price: f.price, profile: f.profile, currency: f.currency });
    if (!opts.length) throw new Error('Add your options with prices (like "Complete, 1500"), or set your main price, so the proposal has real numbers.');
    if (built) warnings.push(`The three options are built from your main price (${f.priceText}): ${opts.map((o) => `${o.name} ${o.priceText}`).join(', ')}. Change them in "Your options" before you send if they don't fit.`);
    const depositRate = f.deposit != null ? f.deposit : f.depositCents ? null : f.profile.deposit || 0;
    if (f.deposit == null && !f.depositCents && f.profile.deposit) warnings.push(`Deposit set to ${Math.round(f.profile.deposit * 100)}% to start, which is common for this kind of work. Change it in the form if you take a different one.`);
    const base = proposal.draft({ f, prospect: p, input: { ...input, name: input.name || (p && p.name) || '' }, opts });

    // AI rewrites the words only. Facts and prices stay fixed.
    const facts = [
      `Business: ${f.displayName}. What it does: ${f.what || 'not given'}.`,
      `Prospect: ${base.name || 'unknown'}${base.company ? ` at ${base.company}` : ''}.`,
      base.heard.length ? `What the prospect told the member: ${base.heard.join(' ')}` : 'The member gave no notes.',
      base.noticed.length ? `Gaps found on the prospect's own website: ${base.noticed.join(' ')}` : '',
      `Options (fixed, most complete first): ${opts.map((o) => `${o.name} ${o.priceText} ${o.per}: ${o.includes.join(', ')}`).join(' | ')}`,
    ]
      .filter(Boolean)
      .join('\n');
    const schema = {
      type: 'object',
      required: ['title', 'heard', 'want', 'vision', 'summaries'],
      properties: {
        title: { type: 'string', maxLength: 90 },
        heard: { type: 'array', items: { type: 'string', maxLength: 160 }, maxItems: 5 },
        want: { type: 'array', items: { type: 'string', maxLength: 140 }, minItems: 2, maxItems: 4 },
        vision: { type: 'string', maxLength: 320 },
        summaries: { type: 'array', items: { type: 'string', maxLength: 120 }, minItems: opts.length, maxItems: opts.length },
      },
    };
    const res = await ai.aiJson(ctx, {
      task: 'write',
      system: 'You write short, warm, plain proposals for a small business owner to send to one prospect. Second person to the prospect. Use only the facts given. Never add numbers, results, reviews or promises that are not in the facts. No placeholders.',
      prompt: `${facts}\n\nWrite: a title (under 10 words, names what gets done, no price), "heard" (the prospect's own points restated in second person, only from what the member wrote; empty if none), "want" (2 to 4 short goals in their words), "vision" (two sentences on what life looks like once it's done, without promising results like sales, leads or views), and one-line "summaries" for each option in the same order.`,
      schema,
      maxTokens: 900,
      accept: NO_FILLER,
      fallback: () => ({ title: base.title, heard: base.heard, want: base.want, vision: base.vision, summaries: base.summaries }),
    });
    const c = { ...base, ...res.data, title: text.clip(input.title || res.data.title || base.title, 100), noticed: base.noticed, heard: base.heard.length ? res.data.heard || base.heard : [] };

    const date = f.today;
    const validUntil = time.addDays(date, Math.max(1, Math.min(90, Number(input.validDays) || 14)));
    const fp = memory.fingerprint('proposal', `${c.name}|${c.company}`, opts.map((o) => ({ label: o.name, qty: 1, price: o.price })), c.title);
    const { number } = await memory.numberFor(ctx, 'proposal', fp, { year: f.year, override: input.number });
    const d = { number, date, validUntil, depositRate, built };
    const htmlStr = proposal.html({ f, d, c, opts, prospect: p });
    const fileAsset = await save.saveFile(ctx, save.fileName('proposal', number, c.company || c.name || 'prospect', '.html'), htmlStr, 'text/html');
    const msg = proposal.messages({ f, d, c, opts });

    if (input.remember !== false) {
      try {
        await memory.saveSettings(ctx, settingsPatch(input, f));
        await memory.recordDoc(ctx, { kind: 'proposal', number, fp, date, customer: c.company || c.name, email: input.email, phone: input.phone, title: c.title, totalCents: Math.round(opts[0].price * 100), items: opts.map((o) => ({ label: o.name, qty: 1, unit: o.unit, price: o.price })) });
      } catch {
        /* best effort */
      }
    }
    if (input.pipeline !== false) await pipeline.log(ctx, { name: c.name || c.company, company: c.name ? c.company : '', email: input.email || (p && p.email) || '', phone: input.phone || '', website: p && p.website }, {
      stage: 'call',
      source: 'Proposal',
      note: `Proposal ${number} made ${time.shortDate(date)}: ${opts.map((o) => `${o.name} ${o.priceText}`).join(', ')}. Good until ${time.shortDate(validUntil)}.`,
      data: { proposal: { number, date, validUntil, options: opts.map((o) => ({ name: o.name, price: o.price })) } },
    });
    if (f.missing.includes('business name')) warnings.push("Your business name isn't set, so the proposal uses your first name. Add it in Settings.");
    if (p && !p.reachable && p.website) warnings.push(`Couldn't read ${p.domain || p.website}: ${p.reason} The proposal uses your notes only.`);
    if (!f.promise && f.promiseIdea) warnings.push(`No promise on this proposal, because you haven't made one. One that could fit your kind of work: "${f.promiseIdea}" Put it in "Your promise" only if you'll keep it.`);
    const kept = input.remember !== false ? [((input.deposit != null && input.deposit !== '') || Number(input.depositAmount) > 0) && 'deposit', input.terms && 'terms', input.promise && 'promise'].filter(Boolean) : [];
    if (kept.length) warnings.push(`Saved your ${text.list(kept)} for your next quotes and proposals. Type new ones any time.`);

    return {
      number,
      date,
      validUntil,
      title: c.title,
      prospect: { name: c.name, company: c.company, email: text.clip(input.email || '', 120), phone: text.clip(input.phone || '', 40), website: (p && p.website) || '' },
      options: opts.map((o, i) => ({ key: o.key, name: o.name, price: o.price, unit: o.unit, per: o.per, priceText: o.priceText, summary: c.summaries[i] || '', includes: o.includes, recommended: o.recommended })),
      built,
      depositRate: depositRate || 0,
      heard: c.heard,
      noticed: c.noticed,
      files: { html: fileAsset },
      message: msg,
      warnings,
      ai: res.ai,
    };
  },
  view(out) {
    const who = out.prospect.company || out.prospect.name || 'your prospect';
    return views.blocks(
      views.text(`Proposal ${out.number} for ${who}: ${out.options.map((o) => `${o.name} ${o.priceText}`).join(', ')}. Good until ${out.validUntil}.`),
      (out.warnings || []).map((w) => views.text(w)),
      views.file(out.files.html, 'Your proposal: open it, then Print or Save as PDF'),
      views.copy(`Email to ${out.prospect.name || who}`, out.message.email, { to: out.prospect.email || '', subject: out.message.subject }),
      views.copy(`Text to ${out.prospect.name || who}`, out.message.text),
      views.table(
        [
          { key: 'name', label: 'Option' },
          { key: 'price', label: 'Price', format: 'money' },
          { key: 'per', label: 'Per' },
          { key: 'note', label: 'Note' },
        ],
        out.options.map((o, i) => ({ name: o.name, price: o.price, per: o.per, note: o.recommended ? 'Recommended' : i === 0 ? 'Most complete' : '' }))
      )
    );
  },
};
