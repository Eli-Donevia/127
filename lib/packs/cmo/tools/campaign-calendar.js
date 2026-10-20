// 30-day campaign calendar: posts on the member's own best days, times and formats (from their post
// exports), a kind of post for each phase of the month, a weekly email idea, and a draft for each.
// The plan is code; an AI drafts the captions from the plan, the thing being promoted, a line about
// the business and the captions of their best posts (as voice examples). The template drafts stand
// when the AI is off or a draft fails the copy check. Nothing is posted or sent.

const { views, save, files, ai } = require('../../_kit');
const { C, R, P, T, X, nameOf, wrap, businessLine, ADVICE } = require('../lib/base');
const KINDS = require('../data/kinds.json');
const K = require('../lib/claims');

const PHASES = [
  { upTo: 6, name: 'Warm up', kinds: ['teach', 'behind'], email: (p) => ({ subject: `What goes into ${p}`, body: `[Two or three lines on how you make it or do it.]` }) },
  { upTo: 13, name: 'Show it', kinds: ['offer', 'behind'], email: (p) => ({ subject: `${p}, up close`, body: `[What it is, who it is for, and one detail people miss.]` }) },
  { upTo: 20, name: 'Proof', kinds: ['proof', 'teach'], email: (p) => ({ subject: `What people say about ${p}`, body: `[One kind note a customer sent, with their OK, and why it mattered to you.]` }) },
  { upTo: 27, name: 'Ask', kinds: ['offer', 'event'], email: (p) => ({ subject: `A reminder about ${p}`, body: `[Where and how to get it, and any dates that matter.]` }) },
  { upTo: 29, name: 'Thank you', kinds: ['recap'], email: null },
];
const DEFAULT_DAYS = [2, 4, 6, 1, 3, 5, 0]; // Tue, Thu, Sat, Mon, Wed, Fri, Sun
const SLOT_TIME = { morning: '09:00', afternoon: '12:30', evening: '18:30' };

function draft(kind, push, where) {
  switch (kind) {
    case 'teach': return `${push}: one thing people ask us. [Your answer in two sentences.] Save this for later.`;
    case 'behind': return `How we make ${push}, start to finish. [One detail only you would know.]`;
    case 'offer': return `${push}. [What it is, in one line.] Made for [who it is for]. ${where}.`;
    case 'proof': return `[First name, with their OK] chose ${push} for [why]. Thank you for sharing this with us.`;
    case 'event': return `Find ${push} at [place] on [day and time]. Come say hi.`;
    default: return `Thank you for a good month. [One thing you learned or loved.] ${where}.`;
  }
}

const KIND_LABEL = (k) => (k === 'recap' ? 'Thank you' : X.kindLabel(k));
const IDEA = (k) => (k === 'recap' ? 'A thank-you post: what this month was like, and one thing you learned.' : (KINDS.kinds.find((x) => x.id === k) || { idea: '' }).idea);

const examples0 = (ps) => [...ps.now].sort((a, b) => b.vx - a.vx).slice(0, 3).map((p) => String(p.caption || '').slice(0, 200)).join('\n');

module.exports = {
  name: 'cmo.campaign_calendar',
  title: 'Plan a 30-day campaign',
  description: "A 30-day calendar for one thing the member wants to promote: posts on their own best days, times and formats from their post exports, a kind of post for each phase, a weekly email idea, and a draft for each, as a calendar file, a sheet and a printable page. Drafts only: nothing is posted or sent.",
  kind: 'ai',
  risk: 'draft',
  needs: [],
  wants: ['stripe', 'shopify'],
  tasks: ['write'],
  credits: 3,
  timeoutSec: 120,
  input: {
    type: 'object',
    properties: {
      push: { type: 'string', title: 'What to promote (optional)', maxLength: 120, description: 'Like "the holiday gift sets". Left empty: your best seller over the last 4 weeks.' },
      start: { type: 'string', title: 'Start date (optional)', format: 'date', description: 'Left empty: tomorrow.' },
      perWeek: { type: 'integer', title: 'Posts a week (optional)', minimum: 1, maximum: 14, description: 'Left empty: about what you post now, at least 3.' },
      email: { type: 'boolean', title: 'Add a weekly email idea', default: true },
      files: C.FILES,
    },
  },
  output: {
    type: 'object',
    properties: { push: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' }, items: { type: 'array' }, basis: { type: 'array' }, headline: { type: 'string' }, ai: { type: 'boolean' }, html: { type: 'object' }, csv: { type: 'object' }, ics: { type: 'object' }, ...C.OUT_COMMON },
    required: ['push', 'from', 'to', 'items', 'basis', 'headline', 'ai', 'html', 'csv', 'ics', 'sample'],
  },
  async run(input, ctx) {
    const d = await R.dataset(ctx, input.files);
    const tz = (ctx.member && ctx.member.timezone) || 'America/Chicago';
    const start = /^\d{4}-\d{2}-\d{2}$/.test(String(input.start || '')) && T.parseDate(input.start) ? input.start : T.addDays(d.today, 1);
    const end = T.addDays(start, 29);
    const basis = [];
    // What to promote.
    let push = String(input.push || '').trim().slice(0, 120);
    const notes = [...d.notes];
    // L76 D3: a promotion line that reads as an income claim, a guarantee, a timed result or a
    // body before-and-after stays out of the drafts, even when the member typed it.
    const pushIssues = K.problems(push).filter((p) => p.id !== 'needs_proof');
    if (pushIssues.length) {
      notes.push(`"${push}" reads as ${pushIssues[0].why}, which ad networks and the FTC don't allow in ads and posts. The drafts say [what you are promoting] instead: put it in plainer words.`);
      push = '';
    }
    if (!push && pushIssues.length) push = '[what you are promoting]';
    if (!push) {
      const span = { from: T.addDays(d.led.to, -27), to: d.led.to, baseFrom: T.addDays(d.led.to, -55), baseTo: T.addDays(d.led.to, -28) };
      const best = X.products(d.records, span)[0];
      const b = (ctx.brain && ctx.brain.business) || {};
      push = best && best.units ? best.name : d.sample ? 'our fall candles' : b.offer || b.what || 'your best seller';
      basis.push(best && best.units ? `Promoting ${push}: your best seller over the last 4 weeks (${X.r0(best.units)} sold).` : `Promoting ${push}. Type what to promote to change it.`);
    }
    // Days, time, formats and channels from their own posts (last 8 weeks).
    const to = d.led.cover.posts ? d.led.cover.posts.to : d.led.to;
    const ps = X.posts(d.records, { from: T.addDays(to, -55), to, baseFrom: T.addDays(to, -55), baseTo: to });
    const pat = X.patterns(ps.now);
    const rate = ps.now.length / 8;
    const perWeek = Math.max(1, Math.min(14, input.perWeek || Math.max(3, Math.min(7, Math.round(rate)))));
    const goodDays = pat.wd.filter((x) => x.n >= 2 && x.vx >= 1).map((x) => x.key);
    const days = [...new Set([...goodDays, ...DEFAULT_DAYS])].slice(0, Math.min(7, perWeek));
    const slot = (pat.slot.find((x) => x.n >= 3) || {}).key;
    const time = SLOT_TIME[slot] || '18:30';
    const formats = pat.format.filter((x) => x.n >= 2);
    const f1 = formats[0] ? formats[0].key : 'video';
    const f2 = formats[1] && formats[1].vx >= 0.9 ? formats[1].key : f1;
    const platforms = [...new Set(ps.now.map((p) => p.src))].filter((s) => s === 'instagram' || s === 'tiktok');
    if (ps.now.length) basis.push(`Post days ${days.map((x) => X.WEEKDAY[x]).join(', ')} at ${time}, mostly ${(X.FORMAT[f1] || 'video').toLowerCase()}: from how your last ${ps.now.length} posts did.`);
    else basis.push(`No post stats in your files, so posts go on ${days.map((x) => X.WEEKDAY[x]).join(', ')} at ${time}. Add an Instagram or TikTok export to fit your own best days.`);
    if (perWeek > 7) basis.push('More than 7 posts a week: some days have 2.');
    const link = d.sample ? 'juniperlane.example' : ctx.brain && ctx.brain.links && ctx.brain.links.website ? String(ctx.brain.links.website).replace(/^https?:\/\//, '').replace(/\/$/, '') : '';
    const where = link ? `Find it at ${link}` : 'Link in bio';
    // Build the calendar.
    const items = [];
    let n = 0;
    for (let i = 0; i < 30; i++) {
      const date = T.addDays(start, i);
      const wd = X.weekday(date);
      const phase = PHASES.find((p) => i <= p.upTo);
      const times = days.includes(wd) ? 1 + (perWeek > 7 && days.indexOf(wd) < perWeek - 7 ? 1 : 0) : 0;
      for (let j = 0; j < times; j++) {
        const kind = phase.kinds[n % phase.kinds.length];
        const format = n % 3 === 2 ? f2 : f1;
        const channel = platforms.length > 1 && format === 'video' ? 'Instagram and TikTok' : platforms.length ? (R.SRC[platforms[n % platforms.length]] || 'Instagram') : 'Instagram';
        items.push({ date, day: R.shortDay(date), time: j ? '12:30' : time, phase: phase.name, channel, format: X.FORMAT[format] || 'Video', kind: KIND_LABEL(kind), idea: IDEA(kind), text: draft(kind, push, where), k: kind });
        n += 1;
      }
      if (input.email !== false && wd === 2 && phase.email) {
        const e = phase.email(push);
        items.push({ date, day: R.shortDay(date), time: '10:00', phase: phase.name, channel: 'Email', format: 'Email', kind: phase.name, idea: 'One short email to your list. Send it from your own email tool.', text: `Subject: ${e.subject}\n\n${e.body}\n\n${where}.`, k: 'email' });
      }
    }
    const hasAds = !!(d.led.cover.ads || d.led.cover.adsSpread);
    if (hasAds) {
      const date = T.addDays(start, 21);
      items.push({ date, day: R.shortDay(date), time: '09:00', phase: 'Ask', channel: 'Ads', format: 'Note', kind: 'Ads', idea: 'Pick the post from weeks 1 to 3 with the most views and run it as an ad, with a budget you choose, in your ads account.', text: 'Your step: in Meta Ads Manager, boost or make an ad from your best post of the last 3 weeks. 127 never starts or changes an ad.', k: 'ads' });
    }
    items.sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));
    // AI drafts for posts and emails, in the member's voice from their best captions.
    const draftable = items.filter((x) => x.k !== 'ads');
    const typed = `${K.typedBy(ctx, input)}\n${push}\n${examples0(ps)}`;
    const examples = [...ps.now].sort((a, b) => b.vx - a.vx).slice(0, 3).map((p) => String(p.caption || '').slice(0, 200)).filter(Boolean);
    const schema = { type: 'object', properties: { drafts: { type: 'array', minItems: draftable.length, maxItems: draftable.length, items: { type: 'string' } } }, required: ['drafts'] };
    const res = await ai.aiJson(ctx, {
      task: 'write',
      system: `You write short social posts and emails for a small business owner, in their voice. One draft per item, in the same order. Posts: under 60 words, one idea, end with where to find it when it fits. Emails: start with "Subject: ", then a blank line, then under 90 words. Keep any [bracket] the owner must fill in with something only they know (customer names, dates, places). Never invent customers, reviews, ratings, customer counts, numbers, prices or dates, and never write as if you were a customer. No number, ranking or superlative ("#1", "best in town", "500+ customers", "5 stars") unless it is in the text you were given. No income claims, no guarantees, no exact result in a set time, no before-and-after about the body or health. Never mention audiences, targeting, pixels or lead forms. No urgency tricks, never promise results. Plain words, no dashes, no emoji, no hashtags beyond 3.`,
      prompt: `Business: ${businessLine(ctx, d)}\nPromoting: ${push}\nWhere to find it: ${where}\n${examples.length ? `Their best recent captions, for voice:\n${examples.map((x) => `- ${x}`).join('\n')}\n` : ''}Items:\n${draftable.map((x, i) => `${i + 1}. ${x.day}, ${x.channel}, ${x.format}, ${x.kind}: ${x.idea}`).join('\n')}`,
      schema,
      maxTokens: 3500,
      accept: (dta) => Array.isArray(dta.drafts) && dta.drafts.length === draftable.length && dta.drafts.every((t, i) => typeof t === 'string' && t.trim().length >= 10 && t.length <= 900 && (draftable[i].k !== 'email' || /^Subject: /.test(t))) && K.clean(dta, typed),
      fallback: () => ({ drafts: draftable.map((x) => x.text) }),
    });
    draftable.forEach((x, i) => {
      x.text = res.data.drafts[i];
    });
    const posts = items.filter((x) => !['email', 'ads'].includes(x.k)).length;
    const emails = items.filter((x) => x.k === 'email').length;
    const headline = `${push}, ${C.shortRange(start, end)}: ${posts} posts${emails ? `, ${emails} emails` : ''}${hasAds ? ', 1 ad step' : ''}. Drafts to edit and post yourself.`;
    const name = nameOf(ctx, d);
    const rows = items.map(({ k, ...x }) => x);
    const body = wrap(d, `<section><h2>How this was planned</h2><div class="card">${P.list([...basis, 'Phases: warm up (week 1), show it (week 2), proof (week 3), ask (week 4), then thank you.'])}</div></section>
${PHASES.map((ph) => {
      const its = rows.filter((x) => x.phase === ph.name);
      return its.length ? `<section><h2>${P.esc(ph.name)}</h2>${its.map((x) => `<div class="card"><span class="tag ${x.channel === 'Email' ? '' : 'p'}">${P.esc(x.day)}, ${P.esc(x.time)}</span><h3>${P.esc(x.channel)}: ${P.esc(x.kind)}${x.format !== 'Email' && x.format !== 'Note' ? ` (${P.esc(x.format.toLowerCase())})` : ''}</h3><p class="muted small">${P.esc(x.idea)}</p><p>${P.esc(x.text).replace(/\n/g, '<br>')}</p></div>`).join('')}</section>` : '';
    }).join('')}
<section><div class="card small muted"><p>${res.ai ? 'Drafts written by AI from your plan and your best captions, then checked for claims you would need to back up. Read each one before you post it.' : 'Drafts from templates: fill in the [brackets].'} ${P.esc(ADVICE)}</p></div></section>`, notes);
    const html = P.page(ctx, { title: `30 days: ${push}`, kicker: 'Campaign calendar', sub: headline, stats: [{ value: String(posts), label: 'posts' }, { value: String(emails), label: 'emails' }, { value: String(days.length), label: 'post days a week' }], body, foot: `${name}. Made ${R.longDay(d.today)}.` });
    const htmlFile = await save.saveFile(ctx, save.fileName(name, 'campaign calendar', start, '.html'), html);
    const csvFile = await save.saveFile(ctx, save.fileName(name, 'campaign calendar', start, '.csv'), files.csv(rows.map((x) => ({ ...x, status: '' })), [{ key: 'date', label: 'Date' }, { key: 'time', label: 'Time' }, { key: 'channel', label: 'Channel' }, { key: 'format', label: 'Format' }, { key: 'kind', label: 'Kind' }, { key: 'phase', label: 'Phase' }, { key: 'idea', label: 'Idea' }, { key: 'text', label: 'Draft' }, { key: 'status', label: 'Posted?' }], { bom: true }));
    const icsFile = await save.saveFile(ctx, save.fileName(name, 'campaign calendar', start, '.ics'), files.ics(rows.map((x, i) => ({ uid: `cmo-${start}-${i}@127group.io`, title: `${x.channel}: ${x.kind}`, description: `${x.idea}\n\nDraft:\n${x.text}`, date: x.date, time: x.time, minutes: 20, tz })), { name: `${push}: 30 days`, now: typeof ctx.now === 'function' ? ctx.now() : Date.now() }));
    ctx.log(headline);
    return { push, from: start, to: end, items: rows, basis, headline, ai: res.ai, html: htmlFile, csv: csvFile, ics: icsFile, sources: C.sources(d), notes, sample: d.sample };
  },
  view(out) {
    return views.blocks(
      out.sample ? views.text(C.sampleLine) : null,
      views.text(out.headline),
      views.cards([...out.notes.filter((n) => /reads as/.test(n)).map((n) => ({ title: 'Check this', body: n })), ...out.basis.map((b) => ({ body: b }))]),
      views.table([{ key: 'day', label: 'Day' }, { key: 'time', label: 'Time' }, { key: 'channel', label: 'Channel' }, { key: 'kind', label: 'Kind' }, { key: 'text', label: 'Draft' }], out.items, 40),
      views.file(out.ics, 'Add to your calendar (.ics)'),
      views.file(out.html, 'Campaign calendar (printable)'),
      views.file(out.csv, 'Campaign sheet (CSV)')
    );
  },
};
