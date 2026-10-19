// gym.case_study: turns one client gym's results into proof for the next sale (every result is the
// next pitch). A short and a long case study, a post for the member's own account, one line
// of proof for follow-ups and calls and a list of proof points, from the numbers the member gives it or the monthly
// reports they already ran. Anonymous unless the owner said yes in writing.

const { caseStudy, gymOf, cleanNumbers, monthKey, shiftMonth, memoryKey, sumMonths, bankId, bankWith, NUMBERS_INPUT } = require('../lib/proof');

module.exports = {
  name: 'gym.case_study',
  title: 'Write a case study',
  description:
    "Turns one client gym's results into proof for your next sale: a short and a long case study, a post for your own account, one line of proof for follow-ups and calls (never a first message) and a list of proof points. Uses only the numbers you give it (or your monthly reports), leaves money out, and names the gym only if the owner said yes in writing.",
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 2,
  input: {
    type: 'object',
    properties: {
      gym: { type: 'object', title: 'Client gym', description: 'A ranked gym from gym.find_gaps, or { name, category, city }' },
      numbers: { ...NUMBERS_INPUT, title: 'Their results', description: 'Only what you actually counted. Left empty, the numbers from your monthly reports for this gym are used.' },
      permission: { type: 'string', title: 'Can you name the gym?', description: "Only 'named' if the owner said yes in writing", enum: ['named', 'anonymous'], default: 'anonymous' },
      quote: { type: 'string', title: "The owner's words (optional)", description: 'Exactly as they wrote them, for example their answers to the testimonial questions', maxLength: 1200 },
      month: { type: 'string', title: 'Month', description: 'The last month the results cover, like 2026-10. Default: the month that is ending', maxLength: 10 },
      months: { type: 'integer', title: 'How many months the results cover', minimum: 1, maximum: 36, default: 1 },
    },
    required: ['gym'],
  },
  output: {
    type: 'object',
    properties: {
      who: { type: 'string' },
      short: { type: 'string' },
      long: { type: 'string' },
      post: { description: 'Null when no result was given' },
      dmLine: { description: 'Null when no result was given' },
      proofPoints: { type: 'array' },
      rules: { type: 'array' },
    },
    required: ['who', 'short', 'long', 'proofPoints', 'rules'],
  },

  async run(input, ctx) {
    const g = gymOf(input.gym);
    if (!g.name) throw new Error('Pick a client gym first.');
    const brain = ctx.brain || {};
    const saved = (brain.packs && brain.packs.gym) || {};
    const tz = (ctx.member && ctx.member.timezone) || 'America/Chicago';
    const now = typeof ctx.now === 'function' ? ctx.now() : Date.now();
    const span = input.months || 1;

    // No numbers typed: total what the member typed into the monthly reports for this gym, and only
    // when every month in the span has a report.
    let numbers = input.numbers;
    let month = input.month;
    if (!Object.keys(cleanNumbers(numbers)).length) {
      const mem = saved[memoryKey(g)];
      const months = (mem && mem.months) || {};
      const last = month ? monthKey(month, now, tz) : Object.keys(months).filter((k) => /^\d{4}-\d{2}$/.test(k)).sort().pop();
      const keys = last ? Array.from({ length: span }, (_, i) => shiftMonth(last, i + 1 - span)) : [];
      if (keys.length && keys.every((k) => months[k])) {
        numbers = sumMonths(keys.map((k) => months[k]));
        month = last;
        if (ctx.log) ctx.log(`Used the numbers from your monthly report${span > 1 ? 's' : ''} for this gym.`);
      }
    }

    const permission = input.permission === 'named' ? 'named' : 'anonymous';
    const out = caseStudy({ row: input.gym, numbers, permission, quote: input.quote, month, months: span, offer: saved.offer || null, now, tz });

    // Keep the newest public-safe line per gym, so follow-ups, calls and proposals can use real proof later
    // (brain.packs.gym.proof_bank). The id is a hash, so the bank never carries an anonymous gym's name.
    if (out.dmLine && typeof ctx.remember === 'function') {
      try {
        const entry = { id: bankId(g), month: out.month, months: span, permission: out.permission, dmLine: out.dmLine, proofPoints: out.proofPoints.slice(0, 3) };
        await ctx.remember('proof_bank', bankWith(saved.proof_bank, entry));
      } catch {
        // The case study stands without it.
      }
    }
    if (ctx.log) ctx.log(permission === 'named' ? 'Case study ready, naming the gym.' : `Case study ready, anonymous: ${out.who}.`);
    return out;
  },

  view(out) {
    const blocks = [
      { type: 'text', text: out.permission === 'named' ? "This names the gym. Use it only with the owner's written OK." : `Anonymous: the gym is "${out.who}".` },
    ];
    if (out.note) blocks.push({ type: 'text', text: out.note });
    blocks.push({ type: 'copy', label: 'Short version (a reply, your site)', text: out.short });
    blocks.push({ type: 'copy', label: 'Long version (your site, a proposal)', text: out.long });
    if (out.post) blocks.push({ type: 'copy', label: 'Post for your own account', text: out.post });
    if (out.dmLine) blocks.push({ type: 'copy', label: 'One line of proof for follow-ups, calls and proposals (not a first message)', text: out.dmLine });
    if (out.proofPoints.length) blocks.push({ type: 'copy', label: 'Proof points', text: out.proofPoints.join('\n') });
    blocks.push({ type: 'text', text: out.rules.join('\n') });
    return blocks;
  },
};
