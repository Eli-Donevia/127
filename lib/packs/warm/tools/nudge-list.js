// Who to nudge today: everyone in the member's Pipeline (every pack's leads) who got a message, hasn't
// answered and is due a follow-up (3 days after the first message, 4 after the second, none after
// the third), each with the nudge ready and one-tap links. Replies still waiting on the member come
// first. Nudges a lead doesn't have yet are written and saved back to the Pipeline, so Do my day has
// them too. People the member pasted (messaged outside 127) join the Pipeline as contacted.

const { views, save, text, time, outreach } = require('../../_kit');
const pg = require('../lib/page');
const { offerFacts } = require('../lib/facts');
const C = require('../lib/contacts');
const P = require('../lib/pipeline');
const A = require('../lib/asks');

const DAY = P.DAY;
const smsHref = (phone, body) => `sms:${phone}?&body=${encodeURIComponent(body)}`;
const handleOf = (url, host) => {
  const m = new RegExp(`${host.replace('.', '\\.')}/([A-Za-z0-9._-]+)`, 'i').exec(String(url || ''));
  return m ? m[1] : '';
};
const dayOf = (ms, tz) => {
  const p = time.partsIn(ms, tz);
  return time.ymd(p.y, p.m, p.d);
};
const ago = (days) => (days == null ? 'a while ago' : days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`);
const nameOf = (l) => (l.name && !/^\[business name\]$/i.test(l.name) ? l.name : l.placeId ? 'A business on Google Maps' : l.company || 'Someone in your Pipeline');

// A nudge for a business that has none written: short, no pitch, no claims. Emails get the footer
// every marketing email needs (D28): name, business, address and the opt-out line.
function businessNudge(lead, n, o, seed) {
  const hi = lead.name && !/^\[/.test(lead.name) ? `Hi ${text.clip(lead.name, 40)} team` : 'Hi there';
  const me = o.firstName ? `, it's ${o.firstName} again` : '';
  return n >= 2
    ? A.fin(`${hi}${me}. Last note from me. If now isn't the time, no problem at all. If it is, I'm happy to help.`)
    : A.fin(`${hi}${me}. ${text.pickBy(`${seed}b`, ['Just floating my note back up in case it got buried.', 'Just checking my note reached you.'])} Happy to answer any questions.`);
}

function emailVersion(body, o) {
  const sign = [o.firstName || '[your name]', o.business || '', outreach.ADDRESS_HOLD].filter(Boolean).join('\n');
  return `${body}\n\n${sign}\n\n${outreach.OPT_OUT}`;
}

// One-tap ways to send, best first. Texts only to people the member knows (no cold texts, FCC).
function waysOf(x, o) {
  const L = x.links || {};
  const out = [];
  if (L.phone && x.warm) out.push({ label: 'Text', href: smsHref(L.phone, x.text) });
  if (L.phone) out.push({ label: 'Call', href: `tel:${String(L.phone).replace(/[^\d+]/g, '')}` });
  if (L.email) {
    const body = x.warm ? x.text : emailVersion(x.text, o);
    const subject = x.subject ? `Re: ${x.subject}` : 'Quick follow-up';
    out.push({ label: 'Email', href: `mailto:${encodeURIComponent(L.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.slice(0, 1800))}` });
  }
  const ig = handleOf(L.instagram, 'instagram.com');
  if (ig) out.push({ label: 'Instagram', href: `https://ig.me/m/${encodeURIComponent(ig)}` });
  const fb = handleOf(L.facebook, 'facebook.com');
  if (fb) out.push({ label: 'Facebook', href: `https://m.me/${encodeURIComponent(fb)}` });
  return out;
}

function sheetHtml({ due, waiting, upcoming, o, today }) {
  const card = (x, i) => {
    const ways = waysOf(x, o).map((w, k) => `<a class="btn${k ? ' ghost' : ''}" href="${pg.esc(w.href)}">${pg.esc(w.label)}</a>`).join('');
    const email = x.links && x.links.email && !x.warm ? `<p class="small muted">The Email button adds your name, business, address and the opt-out line.</p>` : '';
    return `<div class="card person"><div class="tag">${i + 1}. ${x.warm ? 'Someone you know' : 'Business'} · Nudge ${x.n} of 2</div><h3>${pg.esc(x.name)}</h3><p class="small">You wrote ${pg.esc(ago(x.days))}.${x.fact ? ` ${pg.esc(x.fact)}` : ''}</p><div class="msg">${pg.esc(x.text)}</div><div class="links">${ways || '<span class="small muted">No number or email saved: copy it into the chat you used.</span>'}</div>${email}<label class="check"><input type="checkbox"><span class="box"></span><span class="txt">Sent</span></label></div>`;
  };
  const extra = `
.person .msg{background:var(--soft);border-radius:12px;padding:12px 14px;margin:10px 0;font-size:15px;line-height:1.45;white-space:pre-wrap}
.links{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}.links .btn{text-decoration:none;padding:8px 16px;border-radius:999px;background:var(--primary);color:var(--on-primary);font-weight:700;font-size:14px}
.links .btn.ghost{background:transparent;color:var(--primary);border:2px solid var(--primary)}
.person .check{border-bottom:0;padding:8px 10px 8px 40px;font-weight:600}.person .check .box{top:8px}
@media print{.links{display:none}}`;
  const body = [
    pg.hero({ eyebrow: 'Follow-ups', title: due.length ? `${due.length} ${due.length === 1 ? 'person' : 'people'} to nudge today` : 'Nobody to nudge today', lede: due.length ? 'One short, friendly nudge each. Tap a button, read it once, send. Two nudges at most, then let it go.' : 'Everyone you messaged is either answered or not due yet.', pills: [time.longDate(today)] }),
    waiting.length ? pg.section('Answer these first', pg.list(waiting.map((w) => ({ html: `<b>${pg.esc(w.name)}</b> replied ${pg.esc(ago(w.days))}${w.reply ? `: "${pg.esc(text.clip(w.reply, 120))}"` : '.'}` }))), { eyebrow: 'They wrote back' }) : '',
    due.length ? pg.section('Nudge today', `<div class="grid g2">${due.map(card).join('')}</div>`) : '',
    upcoming.length ? pg.section('Coming up', pg.list(upcoming.map((u) => `${u.name}: nudge ${u.n} on ${time.shortDate(u.date)}`)), { eyebrow: 'Not yet' }) : '',
    pg.foot('You send every message yourself. Mark replies in your Pipeline so the nudges stop.', 'Made with 127'),
  ].join('');
  return pg.doc({ title: 'Who to nudge today', pal: { ...o.palette }, body, extra });
}

module.exports = {
  name: 'warm.nudge_list',
  title: 'Find who to nudge',
  description: 'Reads your Pipeline for everyone who got a message, has not answered and is due a nudge today, writes any nudge that is missing (and saves it back), and makes a nudge sheet with one-tap links. Replies waiting on you come first.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  input: {
    type: 'object',
    properties: {
      messaged: { type: 'string', maxLength: 8000, title: 'People you messaged outside 127 (optional)', description: 'One per line: name, phone or email, and when ("Dana Brooks, 512 555 0142, Oct 12").' },
      what: { type: 'string', maxLength: 200 },
      max: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
    },
  },
  output: {
    type: 'object',
    properties: { due: { type: 'array' }, waiting: { type: 'array' }, upcoming: { type: 'array' }, written: { type: 'integer' }, added: { type: 'integer' }, total: { type: 'integer' }, file: { type: 'object' }, sample: { type: 'boolean' } },
    required: ['due', 'waiting', 'upcoming'],
  },
  async run(input, ctx) {
    const o = offerFacts(ctx, input);
    const now = ctx.now();
    const tz = time.tzOf(ctx);
    const today = time.today(ctx);
    const max = Math.max(1, Math.min(100, Number(input.max) || 25));
    const leads = await P.allLeads(ctx);
    const due = [];
    const upcoming = [];
    for (const l of leads) {
      const d = P.nudgeDue(l, now);
      if (!d) continue;
      const last = Date.parse(l.lastTouchAt || l.sentAt || '');
      const row = { id: l.id || null, key: l.key, name: nameOf(l), warm: !!l.warm, n: d.n, links: l.links || {}, subject: (l.msg && l.msg.subject) || '', fact: (l.facts || [])[0] || '', days: Number.isFinite(last) ? Math.floor((now - last) / DAY) : null, at: d.at, lead: l };
      if (d.due) due.push(row);
      else upcoming.push({ name: row.name, n: d.n, date: dayOf(d.at, tz) });
    }
    const waiting = leads.filter(P.repliedWaiting).map((l) => ({ name: nameOf(l), reply: l.reply || '', days: l.repliedAt ? Math.floor((now - Date.parse(l.repliedAt)) / DAY) : null }));
    // People the member messaged outside 127 and pasted here.
    let added = 0;
    const pasted = input.messaged ? P.parseMessaged(input.messaged, now, tz) : [];
    for (const p of pasted) {
      if (P.findByName(leads, p.name)) continue;
      if (p.days != null && p.days < 3) {
        upcoming.push({ name: p.name, n: 1, date: time.addDays(today, 3 - p.days) });
        continue;
      }
      const x = { id: null, key: P.personKey(p), name: p.name, warm: true, n: 1, links: { ...(p.phones[0] ? { phone: p.phones[0] } : {}), ...(p.emails[0] ? { email: p.emails[0] } : {}) }, subject: '', fact: '', days: p.days, at: p.sentAt ? p.sentAt + 3 * DAY : now, pasted: p };
      due.push(x);
    }
    due.sort((a, b) => Number(b.warm) - Number(a.warm) || a.at - b.at);
    const today25 = due.slice(0, max);
    let written = 0;
    for (const [i, x] of today25.entries()) {
      const seed = `${x.key}${x.n}`;
      const have = x.lead && x.lead.msg ? x.lead.msg[x.n >= 2 ? 'follow2' : 'follow1'] : '';
      x.text = have ? text.plain(have) : x.warm ? A.nudgeText({ name: x.name }, x.n, seed) : businessNudge(x.lead || x, x.n, o, seed);
      // A Google listing's name is never stored (Places terms): keep the greeting plain in a saved file.
      x.text = x.text.replace(/\[business name\] team/gi, 'there').replace(/\[business name\]/gi, 'your business');
      if (!have && x.lead && x.id && ctx.leads && typeof ctx.leads.update === 'function') {
        try {
          await ctx.leads.update(x.id, { msg: { [x.n >= 2 ? 'follow2' : 'follow1']: x.text } });
          written++;
        } catch {
          /* the Pipeline is best effort */
        }
      }
      // Saved even without a phone or email, so a repeat run (suggestSchedule) finds them by name and
      // follows their own nudge dates instead of listing them again every morning.
      if (x.pasted) {
        const p = x.pasted;
        const row = P.warmRow({ ...p, note: '' }, { kind: 'first_25', textMsg: '', follow1: x.text, follow2: A.nudgeText({ name: p.name }, 2, `${seed}2`), fact: 'You messaged them outside 127.', score: 58 - i * 0.5, sample: !!ctx.sample });
        delete row.msg.dm;
        if (p.sentAt) row.sentAt = new Date(p.sentAt).toISOString();
        row.stage = 'contacted';
        added += await P.saveRows(ctx, [row]);
      }
    }
    const out = today25.map((x) => ({ name: x.name, warm: x.warm, n: x.n, days: x.days, text: x.text, fact: x.fact, links: x.links, subject: x.subject }));
    upcoming.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const file = await save.saveFile(ctx, save.fileName('who to nudge', today, '.html'), sheetHtml({ due: out, waiting, upcoming: upcoming.slice(0, 15), o, today }));
    ctx.log(`${out.length} nudges due today, ${waiting.length} replies waiting${written ? `, ${written} nudges saved to the Pipeline` : ''}`);
    const sample = out.length > 0 && today25.every((x) => x.lead && x.lead.data && x.lead.data.sample);
    return { due: out, waiting, upcoming: upcoming.slice(0, 15), written, added, total: due.length, file, sample };
  },
  view(out) {
    const next = out.upcoming[0];
    return views.blocks(
      views.metric('Nudge today', out.due.length, out.total > out.due.length ? `${out.total} due in all; the rest tomorrow` : out.due.length ? 'Two nudges at most each, then let it go' : 'Nobody is due yet'),
      out.waiting.length ? views.text(`${out.waiting.length} ${out.waiting.length === 1 ? 'person' : 'people'} replied and ${out.waiting.length === 1 ? 'is' : 'are'} waiting on you: ${text.list(out.waiting.slice(0, 5).map((w) => w.name))}. Answer them first with Answer a reply.`) : null,
      out.due.map((x) => views.copy(`${x.name}: nudge ${x.n} of 2 (you wrote ${ago(x.days)})`, x.text)),
      !out.due.length && next ? views.text(`Next up: ${next.name}, nudge ${next.n} on ${time.shortDate(next.date)}.`) : null,
      !out.due.length && !next && !out.waiting.length ? views.text('Nothing in your Pipeline is waiting on a nudge. Send your next texts first: Reconnect or Ask for referrals.') : null,
      out.written ? views.text(`${out.written} nudges were missing, so they're written and saved to your Pipeline for Do my day.`) : null,
      out.added ? views.text(`${out.added} people you pasted are in your Pipeline now, so their next nudge comes up on time.`) : null,
      views.file(out.file, 'Who to nudge today (open on your phone)')
    );
  },
};
