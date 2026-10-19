// gym.monthly_report: the month-end report for one client gym. The numbers in the owner's language
// (trial sign-ups, new members and what they're worth, then reach), the testimonial and intro asks
// right after them, next month's videos, three ways to grow the account, and a one-page report to
// attach. Drafts only: the member reads them and sends them from their own email.

const { monthlyReport, reportHtml, gymOf, cleanNumbers, monthKey, shiftMonth, memoryKey, lastBefore, rememberMonth, NUMBERS_INPUT } = require('../lib/proof');
const { plain } = require('../lib/util');

module.exports = {
  name: 'gym.monthly_report',
  title: 'Monthly client report',
  description:
    "Turns one client gym's numbers for the month into a one-page report in the owner's language (trial sign-ups, new members and what they're worth, then reach), an email with the testimonial and intro asks, next month's videos and three ways to grow the account. Uses only the numbers you give it. Drafts only: you send them yourself.",
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 2,
  input: {
    type: 'object',
    properties: {
      gym: { type: 'object', title: 'Client gym', description: 'A ranked gym from gym.find_gaps, or { name, category, city } (add ownerName and email if you have them)' },
      month: { type: 'string', title: 'Month', description: 'Like 2026-10. Default: the month that is ending', maxLength: 10 },
      numbers: NUMBERS_INPUT,
      previous: { type: 'object', title: "Last month's numbers (optional)", description: "Same fields. Left empty, last month's report fills them in." },
      offer: { type: 'object', title: 'Your offer', description: 'From gym.offer. Default: the offer you saved' },
      fee: { type: 'number', title: 'What this gym pays you a month ($)', description: "Default: your offer's current price", minimum: 1, maximum: 20000 },
      referralGift: { type: 'string', title: 'What a gym they introduce gets from you', description: 'Default: a free sample Reel made for their gym', maxLength: 120 },
    },
    required: ['gym'],
  },
  output: {
    type: 'object',
    properties: {
      gym: { type: 'string' },
      month: { type: 'string' },
      headline: { type: 'string' },
      rows: { type: 'array' },
      wins: { type: 'array' },
      roi: { description: 'Null unless new members and a member price are both known' },
      next: { type: 'array' },
      asks: { type: 'object' },
      upsell: { type: 'object' },
      email: { type: 'object' },
      asset: { type: 'object' },
    },
    required: ['gym', 'month', 'headline', 'rows', 'wins', 'next', 'asks', 'upsell', 'email', 'asset'],
  },

  async run(input, ctx) {
    const g = gymOf(input.gym);
    if (!g.name) throw new Error('Pick a client gym first.');
    const brain = ctx.brain || {};
    const saved = (brain.packs && brain.packs.gym) || {};
    const tz = (ctx.member && ctx.member.timezone) || 'America/Chicago';
    const now = typeof ctx.now === 'function' ? ctx.now() : Date.now();
    const month = monthKey(input.month, now, tz);

    // Last month's numbers and ideas come from the last report for this gym, unless typed in.
    const key = memoryKey(g);
    const mem = saved[key];
    const last = lastBefore(mem, month);
    const typedPrev = cleanNumbers(input.previous);
    const prev = Object.keys(typedPrev).length ? { month: shiftMonth(month, -1), numbers: typedPrev } : last;

    const rep = monthlyReport({
      row: input.gym,
      offer: input.offer || saved.offer || null,
      month,
      numbers: input.numbers,
      member: ctx.member || {},
      business: brain.business || {},
      previous: prev.numbers,
      previousMonth: prev.month,
      history: mem && mem.months,
      skipIdeas: last.ideas,
      fee: input.fee,
      referralGift: input.referralGift || saved.referral_gift || null,
      now,
      tz,
    });

    let asset;
    try {
      asset = await ctx.save(rep.fileName, reportHtml(rep), { type: 'text/html' });
    } catch {
      throw new Error("Couldn't save the report file. Try again in a minute.");
    }

    if (typeof ctx.remember === 'function') {
      try {
        await ctx.remember(key, rememberMonth(mem, month, rep.numbers, g.name, rep.next.map((i) => i.title)));
        if (input.referralGift) await ctx.remember('referral_gift', plain(input.referralGift));
      } catch {
        // Memory only adds next month's change line; the report stands without it.
      }
    }
    if (ctx.log) ctx.log(plain(`Report ready for ${g.name}, ${rep.monthLabel}: ${rep.headline}`));

    const { page, fileName, ...out } = rep;
    return { ...out, asset, sample: g.sample };
  },

  view(out) {
    const blocks = [{ type: 'text', text: out.headline }];
    for (const m of out.metrics || []) blocks.push({ type: 'metric', label: m.label, value: m.value, note: m.note });
    if (out.roi) blocks.push({ type: 'text', text: out.roi.text });
    if (out.toDate) blocks.push({ type: 'text', text: out.toDate.text });
    if (out.rows.length) {
      blocks.push({
        type: 'table',
        columns: [
          { key: 'label', label: out.monthLabel || 'This month' },
          { key: 'display', label: 'Number' },
          { key: 'change', label: 'Change' },
        ],
        rows: out.rows.map((r) => ({ label: r.label, display: r.display, change: r.changeText || r.note || '' })),
        limit: 12,
      });
    } else {
      blocks.push({ type: 'text', text: 'No numbers yet. Add what you counted this month and run it again: any number you leave out stays out of the report.' });
    }
    blocks.push({
      type: 'copy',
      label: `Email to ${out.gym}, with the report attached`,
      text: `Subject: ${out.email.subject}\n\n${out.email.body}`,
      email: out.email.to ? { to: out.email.to, subject: out.email.subject } : undefined,
    });
    blocks.push({ type: 'file', asset: out.asset, label: `${out.gym}, ${out.monthLabel || out.month} report` });
    blocks.push({ type: 'copy', label: 'Ask for a testimonial (on its own)', text: out.asks.testimonial });
    blocks.push({ type: 'copy', label: 'Ask for an intro (on its own)', text: out.asks.referral });
    blocks.push({ type: 'copy', label: 'Grow the account: more', text: out.upsell.more });
    blocks.push({ type: 'copy', label: 'Grow the account: better', text: out.upsell.better });
    blocks.push({ type: 'copy', label: 'Grow the account: new', text: out.upsell.new });
    if (out.tips && out.tips.length) blocks.push({ type: 'text', text: out.tips.join('\n') });
    return blocks;
  },
};
