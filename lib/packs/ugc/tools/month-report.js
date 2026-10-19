// The month-end report for a brand on a monthly plan: what was made (the videos the member lists, or
// the jobs "Deliver a paid job" logged for them this month), the numbers the brand shared (labeled as
// theirs: the member doesn't see their ad account), what the member noticed, next month's plan and
// dates, and one idea for next month at the member's price, with no promise of results. Also the email
// to send it with and next month's dates for the calendar. Safe to run every month on a schedule: the
// file is named for its month, and numbers repeated from an earlier month's report are left out.

const kit = require('../../_kit');
const { text, views, files, save, brain, time, money } = kit;
const talk = require('../../_kit/talk');
const close = require('../lib/close');
const offer = require('../lib/offer');
const pages = require('../lib/pages');

const usd = (n) => money.usd(n);
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

// "2026-10", "October 2026", "oct" -> "2026-10"; the current month when blank or unclear.
function monthKey(input, today) {
  const s = String(input || '').trim().toLowerCase();
  const [ty, tm] = today.split('-').map(Number);
  let m = s.match(/^(\d{4})-(\d{1,2})$/);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return `${m[1]}-${String(Number(m[2])).padStart(2, '0')}`;
  m = s.match(/^([a-z]{3,9})\.?\s*(\d{4})?$/);
  if (m) {
    const i = MONTHS.findIndex((x) => x.startsWith(m[1].slice(0, 3)));
    if (i >= 0) {
      const y = m[2] ? Number(m[2]) : i + 1 > tm ? ty - 1 : ty;
      return `${y}-${String(i + 1).padStart(2, '0')}`;
    }
  }
  return `${ty}-${String(tm).padStart(2, '0')}`;
}

const monthName = (key) => {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[m - 1].charAt(0).toUpperCase()}${MONTHS[m - 1].slice(1)} ${y}`;
};
const nextKey = (key) => {
  const [y, m] = key.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
};

// "Title | date | link" lines -> [{ title, date, link }].
function deliveredLines(s) {
  return String(s || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((l) => {
      const url = (l.match(/https:\/\/\S+/) || [])[0] || '';
      const parts = l.replace(url, '').split('|').map((x) => text.oneLine(x)).filter(Boolean);
      const date = parts.find((p) => /^\d{4}-\d{2}-\d{2}$/.test(p));
      return { title: text.clip(parts.filter((p) => p !== date)[0] || 'Video', 80), date: date ? time.shortDate(date) : '', link: url.replace(/[),.]+$/, '') };
    });
}

// "Label | value" or "Label: value" lines -> [{ label, value }], as typed.
function sharedLines(s) {
  return String(s || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((l) => {
      const m = l.match(/^(.+?)\s*(?:\||:)\s*(.+)$/);
      return m ? { label: text.clip(text.oneLine(m[1]), 60), value: text.clip(text.oneLine(m[2]), 40) } : { label: text.clip(text.oneLine(l), 80), value: '' };
    });
}

const linesOf = (s, max = 6) =>
  String(s || '')
    .split('\n')
    .map((l) => text.clip(text.oneLine(l.replace(/^\s*(?:[-*\u2022]|\d{1,2}[.)])\s+/, '')), 200))
    .filter(Boolean)
    .slice(0, max);

// A short fingerprint of what was typed, to spot the same numbers sent again next month.
function sig(parts) {
  const s = parts.map((p) => talk.norm(p)).join('|');
  if (!s.replace(/\|/g, '')) return '';
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return String(h);
}

module.exports = {
  name: 'ugc.month_report',
  title: 'Write the month-end report',
  description: 'A one-page monthly report for a brand: the videos you made, the numbers they shared (labeled as theirs), what you noticed, next month\'s plan and dates, and one idea for next month at your price. With the email to send and the dates for your calendar.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 2,
  input: {
    type: 'object',
    required: ['lead'],
    properties: {
      lead: { type: 'object' },
      month: { type: 'string', maxLength: 20 },
      videos: { type: 'integer', minimum: 0, maximum: 60 },
      delivered: { type: 'string', maxLength: 3000 },
      hooks: { type: 'integer', minimum: 0, maximum: 60 },
      edits: { type: 'integer', minimum: 0, maximum: 30 },
      shared: { type: 'string', maxLength: 2000 },
      learned: { type: 'string', maxLength: 2000 },
      next: { type: 'string', maxLength: 2000 },
      price: { type: 'number', minimum: 0, maximum: 20000 },
      upsell: { type: 'string', enum: ['auto', 'hooks', 'ads', 'whitelist', 'none'] },
      contact: { type: 'string', maxLength: 80 },
      email: { type: 'string', maxLength: 160 },
      myName: { type: 'string', maxLength: 60 },
      myContact: { type: 'string', maxLength: 160 },
      color: { type: 'string', maxLength: 7 },
    },
  },
  output: { type: 'object', required: ['brand', 'month', 'file', 'email'], properties: { brand: { type: 'string' }, month: { type: 'string' }, file: { type: 'object' }, email: { type: 'object' }, calendar: { type: 'object' } } },
  timeoutSec: 30,
  async run(input, ctx) {
    const lead = input.lead || {};
    const today = time.today(ctx);
    const name = text.plain(lead.name || 'This brand');
    const s = close.shortName(name);
    const key = monthKey(input.month, today);
    const month = monthName(key);
    const nk = nextKey(key);
    const nextMonth = monthName(nk);
    const br = brain.brainOf(ctx, {});
    const mem = brain.packMemory(ctx, 'ugc') || {};
    const me = { name: text.plain(input.myName || br.firstName || br.name || ''), contact: text.oneLine(input.myContact || br.email || '') };
    const n = offer.offerNumbers({}, ctx);
    const plan = offer.pkgOf(n, 'monthly');
    const price = money.num(input.price, null) || plan.price;
    const brandKey = text.slug(s, 40);

    // Jobs "Deliver a paid job" logged for this brand, due this month.
    const jobs = (Array.isArray(mem.jobs) ? mem.jobs : []).filter((j) => j && text.slug(close.shortName(j.brand || ''), 40) === brandKey && String(j.due || '').startsWith(key));
    let delivered = deliveredLines(input.delivered);
    let shared = sharedLines(input.shared);
    let learned = linesOf(input.learned);
    const fromLog = !delivered.length && jobs.length;
    if (fromLog) delivered = jobs.flatMap((j) => Array.from({ length: Math.max(1, Number(j.videos) || 1) }, (_, i) => ({ title: `${j.product || 'Video'}${Number(j.videos) > 1 ? `, video ${i + 1}` : ''}`, date: time.shortDate(j.due), link: '' })));

    // The same typed numbers as an earlier month's report: a scheduled run repeating last month's inputs.
    const reports = Array.isArray(mem.reports) ? mem.reports : [];
    const typedSig = sig([input.delivered, input.shared, input.learned]);
    const stale = typedSig && reports.some((r) => r && r.brand === brandKey && r.month !== key && r.sig === typedSig);
    if (stale) {
      shared = [];
      learned = [];
      if (!fromLog) delivered = [];
    }

    const videos = Number.isInteger(input.videos) && !stale ? input.videos : delivered.length || jobs.reduce((t, j) => t + (Number(j.videos) || 0), 0);
    const hooks = Number.isInteger(input.hooks) && !stale ? input.hooks : jobs.reduce((t, j) => t + (Number(j.hooks) || 0), 0);
    const edits = Number.isInteger(input.edits) && !stale ? input.edits : null;
    const counts = [
      { label: 'Videos delivered', value: String(videos) },
      { label: 'Extra hooks', value: String(hooks) },
      edits != null ? { label: 'Rounds of edits', value: String(edits) } : { label: `Videos planned for ${nextMonth.split(' ')[0]}`, value: String(plan.videos) },
    ];

    // Next month: what the member typed, else the plan; and the dates.
    const [ny, nm] = nk.split('-').map(Number);
    const day = (d) => `${ny}-${String(nm).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const nextPlan = linesOf(input.next).length ? linesOf(input.next) : [`${plan.videos} new videos, the same plan at ${usd(price)} a month`, 'Product picks and hooks agreed in a short brief at the start of the month'];
    const dates = [
      { when: time.longDate(day(3)), what: `Brief for ${nextMonth.split(' ')[0]}: products and hooks` },
      { when: time.longDate(day(12)), what: 'Videos 1 and 2' },
      { when: time.longDate(day(26)), what: `Videos 3 and 4` },
      { when: time.longDate(day(28)), what: `${nextMonth.split(' ')[0]} report` },
    ];

    // One idea for next month, at the member's prices, with no promise of what it will do.
    const said = `${input.shared || ''} ${input.learned || ''} ${input.next || ''}`;
    const runsAds = /\b(ad spend|spend|roas|ctr|cpa|cpc|cpm|meta|facebook|tiktok ads|ads?|campaign)\b/i.test(said);
    let pick = input.upsell && input.upsell !== 'auto' ? input.upsell : runsAds ? (hooks > 0 ? 'whitelist' : 'hooks') : 'ads';
    const UPSELL = {
      hooks: { label: 'Extra hooks on the videos you have', pitch: 'A new first 3 seconds on a video you already have, so you can test which opening holds attention best. Same video, new start.', priceText: `${usd(n.hook)} a hook` },
      ads: { label: 'Ad use for your favorite video', pitch: 'Run the video you like most as a paid ad. Ad use starts on the first day you spend on it.', priceText: `${usd(n.ads30)} for 30 days, ${usd(n.ads90)} for 90` },
      whitelist: { label: 'Spark Ads from my account', pitch: 'Your best video runs as an ad from my handle, with my written yes, for the days you buy. I can see and end the access.', priceText: `${usd(n.whitelist)} per platform for 30 days` },
    };
    const upsell = pick === 'none' ? null : UPSELL[pick] || null;
    if (!upsell) pick = 'none';

    const to = text.oneLine(input.contact || '').split(' ')[0] || '';
    const html = pages.reportHtml({ brand: s, to, month, member: me, counts, delivered, shared, learned, next: nextPlan, dates, upsell, made: time.longDate(today), color: input.color });
    const file = await save.saveFile(ctx, save.fileName(s, `report ${key}`, '.html'), html, 'text/html');

    // The email to send it with: one question at the end.
    const first = nextMonth.split(' ')[0];
    const paras = [
      to ? `Hi ${to},` : 'Hi,',
      [`Here's the ${month.split(' ')[0]} report for ${s}: ${videos} ${videos === 1 ? 'video' : 'videos'} delivered${hooks ? `, ${hooks} extra ${hooks === 1 ? 'hook' : 'hooks'}` : ''}${edits ? `, ${edits} ${edits === 1 ? 'round' : 'rounds'} of edits` : ''}. It's attached.`, shared.length ? 'Thanks for sharing your numbers. They are in the report exactly as you sent them.' : ''].filter(Boolean).join(' '),
      learned.length ? `One thing I noticed: ${learned[0].replace(/\.$/, '')}.` : '',
      `For ${first}: ${nextPlan[0].replace(/\.$/, '')}. The first 2 videos land by ${time.shortDate(day(12)).replace(/^[A-Z][a-z]{2}, /, '')}.`,
      upsell ? `One idea for ${first}: ${upsell.label}, ${upsell.priceText}. ${upsell.pitch} Want me to add it?` : `Want to keep the same plan for ${first}?`,
      me.name || '[your name]',
    ];
    const body = paras.filter(Boolean).join('\n\n');
    const email = { to: text.oneLine(input.email || lead.email || ''), subject: `${s}: your ${month.split(' ')[0]} videos and the ${nextMonth.split(' ')[0]} plan`, body };

    let calendar = null;
    try {
      const ics = files.ics(
        dates.map((d, i) => ({ uid: `ugc-month-${brandKey}-${nk}-${i}@127group.io`, title: `${s}: ${d.what}`, date: day([3, 12, 26, 28][i]), allDay: true })),
        { name: `${s} monthly plan`, now: time.nowMs(ctx) },
      );
      calendar = await save.saveFile(ctx, save.fileName(s, `plan ${nk}`, '.ics'), ics, 'text/calendar');
    } catch {
      calendar = null;
    }

    if (typedSig && !stale) {
      const keep = reports.filter((r) => r && !(r.brand === brandKey && r.month === key)).slice(-23);
      await brain.remember(ctx, 'reports', [...keep, { brand: brandKey, month: key, sig: typedSig, made: today }]);
    }
    ctx.log(`${month} report for ${s}: ${videos} videos${upsell ? `, one idea: ${upsell.label}` : ''}`);
    return { brand: s, month, key, videos, hooks, edits, counts, delivered, shared, learned, next: nextPlan, dates, upsell, pick, file, email, calendar, stale: !!stale, fromLog: !!fromLog, price };
  },
  view(out) {
    return views.blocks(
      views.metric(`${out.month} for ${out.brand}`, `${out.videos} ${out.videos === 1 ? 'video' : 'videos'}`, out.hooks ? `${out.hooks} extra ${out.hooks === 1 ? 'hook' : 'hooks'}` : undefined),
      out.stale ? views.text('These numbers match an earlier month\'s report, so they were left out. Type this month\'s numbers and run it again to add them.') : null,
      out.fromLog ? views.text('The videos come from the jobs you logged with "Deliver a paid job" this month.') : null,
      !out.videos ? views.text('Type how many videos you delivered this month, and the report counts them.') : null,
      out.email.to ? views.copy(`Email to send with the report (subject: ${out.email.subject})`, out.email.body, { to: out.email.to, subject: out.email.subject }) : views.copy('Email to send with the report', `Subject: ${out.email.subject}\n\n${out.email.body}`),
      views.file(out.file, 'The report to attach (print or save as PDF)'),
      out.upsell ? views.cards([{ title: `One idea: ${out.upsell.label}`, subtitle: out.upsell.priceText, body: out.upsell.pitch }]) : null,
      views.table([{ key: 'when', label: 'When' }, { key: 'what', label: 'Next month' }], out.dates),
      views.file(out.calendar, 'Next month\'s dates, for your calendar'),
      views.text('Every number in the report is one you typed or a count of what you delivered. Never add views, sales or results the brand didn\'t share.'),
    );
  },
};
