// The send sheet: every person with their message and one-tap Text, Call and Email links, boxes to
// tick, plus a tracker sheet with follow-up dates and a calendar file for the follow-ups. Three kinds:
// Your first 25 (the asks), Reconnect (catch-up texts, with what to say once they write back) and
// Referral asks (with the note to forward and the thank-you). Everyone with a number or an email also
// goes into the member's Pipeline (warm: true, the text, two nudges), so Do my day can hand them out.

const { views, save, time, text } = require('../../_kit');
const pg = require('../lib/page');
const { Sheet } = require('../lib/sheet');
const { icsWithAlarms } = require('../lib/cal');
const { offerFacts } = require('../lib/facts');
const C = require('../lib/contacts');
const P = require('../lib/pipeline');
const A = require('../lib/asks');

const smsHref = (phone, body) => `sms:${phone}?&body=${encodeURIComponent(body)}`;
const GROUP_LABEL = { ...C.GROUPS, reconnect: 'Reconnect', customer: 'Customer', friend: 'Friend' };

const MODES = {
  first_25: {
    file: 'your-first-25',
    eyebrow: 'Your first 25',
    title: (n) => `${n} people who know you`,
    lede: 'Tap Text to open your messages app with the words ready. Change anything that does not sound like you, then send. Tick each box as you go.',
    tips: ['Send 5 now, while this is open. The rest by tonight.', 'Reply to every answer the same day.', 'No answer in 3 days? One friendly nudge, then let it go.'],
    after: '',
    events: [
      { days: 3, title: 'Follow up with your first 25', description: 'Open your tracker. One friendly nudge to anyone who has not answered.' },
      { days: 7, title: 'Last nudge, then let it go', description: 'Thank everyone who replied. Ask anyone who said yes for one name.' },
    ],
    calName: 'First 25 follow-ups',
  },
  reconnect: {
    file: 'reconnect',
    eyebrow: 'Reconnect',
    title: (n) => `${n} people to catch up with`,
    lede: 'The first text asks for nothing. When they write back, answer them first, then mention what you do once. Tick each box as you go.',
    tips: ['Send 5 now. Catch-ups land best in the evening or on a weekend.', 'When they answer, talk about them first. Mention your business once, lightly.', 'No answer in 3 or 4 days? One friendly hello, then let it go.'],
    after: 'When they write back',
    events: [
      { days: 4, title: 'Say hi again to anyone quiet', description: 'Open your reconnect sheet. One friendly hello to anyone who has not answered, then let it go.' },
    ],
    calName: 'Reconnect nudges',
  },
  referrals: {
    file: 'referral-asks',
    eyebrow: 'Referral asks',
    title: (n) => `${n} people who could send you someone`,
    lede: 'Ask for one name, not a favor. When they say yes, send the note they can forward. When someone books, send your thank-you the same day.',
    tips: ['Ask your happiest customers first, right after a great visit.', 'Make it easy: send the forward note the moment they say yes.', 'Thank them for every intro, booked or not. Never offer anything for a review.'],
    after: 'When they say yes, send this to forward',
    events: [
      { days: 3, title: 'Nudge your referral asks', description: 'One friendly nudge to anyone who has not answered. Thank everyone who sent a name.' },
    ],
    calName: 'Referral nudges',
  },
};

// Default nudges for Your first 25 (its writer has none of its own).
const FIRST_NUDGE = (x, seed) => A.nudgeText({ name: x.name }, 1, seed);
const SECOND_NUDGE = (x, seed) => A.nudgeText({ name: x.name }, 2, seed);
const SCORE = { buy: 82, customer: 78, refer: 66, friend: 62, reconnect: 60, advise: 55 };

function sheetHtml(items, o, today, mode, extras) {
  const m = MODES[mode];
  const cards = items.map((x, i) => {
    const links = [
      x.phone ? `<a class="btn" href="${pg.esc(smsHref(x.phone, x.text))}">Text</a>` : '',
      x.phone ? `<a class="btn ghost" href="tel:${pg.esc(x.phone)}">Call</a>` : '',
      x.email ? `<a class="btn ghost" href="mailto:${pg.esc(x.email)}?subject=${encodeURIComponent(mode === 'reconnect' ? 'Hello!' : 'Quick hello')}&body=${encodeURIComponent(x.text)}">Email</a>` : '',
    ].join('');
    const after = x.after && m.after
      ? `<div class="after"><div class="lab">${pg.esc(m.after)}</div><div class="msg2">${pg.esc(x.after)}</div>${x.phone ? `<a class="mini" href="${pg.esc(smsHref(x.phone, x.after))}">Text this</a>` : ''}</div>`
      : '';
    const nudge = x.nudge ? `<div class="after"><div class="lab">No answer in ${mode === 'reconnect' ? '3 or 4' : '3'} days</div><div class="msg2">${pg.esc(x.nudge)}</div></div>` : '';
    const noWay = !x.phone && !x.email ? '<p class="small muted">No number or email here: copy the text into your phone.</p>' : '';
    return `<div class="card person"><div class="tag">${i + 1}. ${pg.esc(GROUP_LABEL[x.group] || '')}</div><h3>${pg.esc(x.name)}</h3><p class="small">${pg.esc(x.why || '')}</p><div class="msg">${pg.esc(x.text)}</div><div class="links">${links}</div>${noWay}${after}${nudge}<div class="ticks"><label class="check"><input type="checkbox" class="sent"><span class="box"></span><span class="txt">Sent</span></label><label class="check"><input type="checkbox" class="rep"><span class="box"></span><span class="txt">Replied</span></label></div><p class="small">${x.phone ? pg.esc(C.showPhone(x.phone)) : ''}${x.phone && x.email ? ' · ' : ''}${pg.esc(x.email || '')}</p></div>`;
  }).join('');
  const extra = `
.person .msg{background:var(--soft);border-radius:12px;padding:12px 14px;margin:10px 0;font-size:15px;line-height:1.45;white-space:pre-wrap}
.after{border-left:4px solid var(--line);padding:4px 0 4px 12px;margin:10px 0}
.after .lab{font-size:11.5px;font-weight:750;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.after .msg2{font-size:14px;line-height:1.45;margin-top:3px;white-space:pre-wrap}
.after .mini{display:inline-block;margin-top:6px;font-size:13px;font-weight:700;color:var(--primary)}
.links{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}.links .btn{text-decoration:none;padding:8px 16px;border-radius:999px;background:var(--primary);color:var(--on-primary);font-weight:700;font-size:14px}
.links .btn.ghost{background:transparent;color:var(--primary);border:2px solid var(--primary)}
.ticks{display:flex;gap:8px;margin:6px 0}.ticks .check{border-bottom:0;padding:8px 10px 8px 40px;font-weight:600}.ticks .check .box{top:8px}
.keep .msg{background:#fff;border:1px dashed var(--primary);border-radius:12px;padding:12px 14px;margin-top:8px;white-space:pre-wrap;font-size:15px;line-height:1.45}
body{counter-reset:sent rep}.sent:checked{counter-increment:sent}.rep:checked{counter-increment:rep}
.score::before{content:counter(sent) " sent, " counter(rep) " replied"}
.score{position:sticky;bottom:12px;margin-top:20px;background:var(--deep);color:var(--on-deep);padding:14px 18px;border-radius:14px;font-weight:800;font-size:18px;text-align:center}
@media print{.links,.after .mini{display:none}.score{display:none}}`;
  const keep = mode === 'referrals'
    ? pg.section('Keep these handy', pg.grid([
      `<div class="card keep"><div class="tag">When they say yes</div><h3>The note they forward</h3><p class="small">Send it right away so the intro takes them 10 seconds.</p><div class="msg">${pg.esc(extras.forward || '')}</div></div>`,
      `<div class="card keep"><div class="tag">When someone books</div><h3>Your thank-you</h3><p class="small">For the intro, never for a review. Send it the same day.</p><div class="msg">${pg.esc(extras.thankYou || '')}</div></div>`,
    ]))
    : '';
  const body = [
    pg.hero({ eyebrow: m.eyebrow, title: m.title(items.length), lede: m.lede, pills: [o.what, time.longDate(today)] }),
    pg.section('Before you start', pg.list(m.tips)),
    keep,
    pg.section(mode === 'first_25' ? 'Your people' : mode === 'reconnect' ? 'Who to text' : 'Who to ask', `<div class="grid g2">${cards}</div>`),
    '<div class="score"></div>',
    pg.foot(extras.saved ? `You send every message yourself. ${extras.saved} of them are in your Pipeline too: tap Sent there so nudges get dated.` : 'You send every message yourself. Nothing is sent for you.', 'Made with 127'),
  ].join('');
  return pg.doc({ title: `${m.eyebrow}: ${m.title(items.length)}`, pal: { ...o.palette }, body, extra });
}

function trackerCsv(items, today, mode) {
  const withAfter = items.some((x) => x.after) && !!MODES[mode].after;
  const sh = new Sheet();
  sh.add(['Name', 'Group', 'Phone', 'Email', 'Message', ...(withAfter ? [MODES[mode].after] : []), 'Nudge', 'Sent on (date)', 'Replied? (yes or no)', 'Follow up on', 'Next step']);
  const first = 2;
  const S = withAfter ? 'H' : 'G';
  const R = withAfter ? 'I' : 'H';
  items.forEach((x) => sh.add((r) => [x.name, GROUP_LABEL[x.group] || '', C.showPhone(x.phone), x.email, x.text, ...(withAfter ? [x.after || ''] : []), x.nudge || '', '', '', `=IF(${S}${r}="","",IF(${R}${r}="yes","",${S}${r}+${mode === 'reconnect' ? 4 : 3}))`, '']));
  const last = first + items.length - 1;
  sh.blank();
  const sent = sh.add(['Sent', `=COUNTA(${S}${first}:${S}${last})`]);
  const rep = sh.add(['Replied', `=COUNTIF(${R}${first}:${R}${last},"yes")`]);
  sh.add(['Reply rate', `=IF(B${sent}=0,"",ROUND(B${rep}/B${sent},2))`]);
  sh.add(['Started', today]);
  return sh.csv();
}

module.exports = {
  name: 'warm.send_sheet',
  title: 'Make my send sheet',
  description: 'Makes a send sheet with each message and one-tap Text, Call and Email links, a tracker sheet with follow-up dates, and calendar reminders for the follow-ups, and adds everyone with a number or email to your Pipeline.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  input: {
    type: 'object',
    properties: {
      items: { type: 'array' },
      mode: { type: 'string', enum: ['first_25', 'reconnect', 'referrals'], default: 'first_25' },
      forward: { type: 'string', maxLength: 600 },
      thankYou: { type: 'string', maxLength: 600 },
      what: { type: 'string', maxLength: 200 },
      pipeline: { type: 'boolean', default: true, title: 'Add them to your Pipeline' },
    },
    required: ['items'],
  },
  output: { type: 'object', properties: { files: { type: 'array' }, count: { type: 'number' }, saved: { type: 'number' }, mode: { type: 'string' } }, required: ['files'] },
  async run(input, ctx) {
    const mode = MODES[input.mode] ? input.mode : 'first_25';
    const m = MODES[mode];
    const o = offerFacts(ctx, input);
    const items = (input.items || []).filter((x) => x && x.name && x.text).slice(0, 25).map((x, i) => ({
      ...x,
      text: text.plain(x.text),
      nudge: x.nudge || (mode === 'first_25' ? FIRST_NUDGE(x, `${x.name}${i}`) : ''),
      nudge2: x.nudge2 || (mode === 'first_25' ? SECOND_NUDGE(x, `${x.name}${i}`) : ''),
    }));
    if (!items.length) throw new Error('No messages to put on the sheet yet.');
    const today = time.today(ctx);
    let saved = 0;
    if (input.pipeline !== false) {
      const rows = items
        .filter((x) => x.phone || x.email)
        .map((x, i) => P.warmRow(x, { kind: mode, textMsg: x.text, follow1: x.nudge, follow2: x.nudge2, answer: mode === 'reconnect' ? x.after : '', fact: x.why, score: (SCORE[x.group] || 60) - i * 0.5, note: x.note, sample: !!(ctx.sample || x.sample) }));
      saved = await P.saveRows(ctx, rows);
    }
    const ev = m.events.map((e) => ({ date: time.addDays(today, e.days), time: '10:00', minutes: 15, title: e.title, description: e.description, alarm: 10 }));
    const files = [
      await save.saveFile(ctx, `${m.file}-send-sheet.html`, sheetHtml(items, o, today, mode, { forward: input.forward, thankYou: input.thankYou, saved })),
      await save.saveFile(ctx, `${m.file}-tracker.csv`, trackerCsv(items, today, mode)),
      await save.saveFile(ctx, `${m.file}-${mode === 'first_25' ? 'follow-ups' : 'nudges'}.ics`, icsWithAlarms(ev, { name: m.calName, tz: o.timezone, now: ctx.now() })),
    ];
    ctx.log(`Send sheet for ${items.length} people${saved ? `, ${saved} added to your Pipeline` : ''}`);
    return { files, count: items.length, saved, mode };
  },
  view(out) {
    return views.blocks(
      views.text(`${out.count} messages ready. Open the send sheet on your phone and tap Text.`),
      out.saved ? views.text(`${out.saved} of them are in your Pipeline now, with nudges written. Tap Sent in Do my day as you go, and their follow-ups come up on time.`) : null,
      out.files.map((f) => views.file(f))
    );
  },
};
