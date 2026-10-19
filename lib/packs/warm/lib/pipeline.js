// The warm pack's side of the member's Pipeline (contract 13): people the member knows, saved with
// warm: true, the text already written (msg.dm), two gentle nudges (msg.follow1, msg.follow2), the
// reason they're on the list (facts) and a score, so Do my day can hand them out. One key per person
// across every warm workflow, so a person added by Your first 25 and again by Reconnect is one row.
// Works on the harness Pipeline and the kit's test Pipeline alike (both have list, upsert, get, update).

const { text, time } = require('../../_kit');
const C = require('./contacts');

const DAY = 864e5;
const STAGES = ['found', 'contacted', 'replied', 'call', 'won', 'lost'];

// Phone first (the same person pasted twice with different notes), then email, then the name.
function personKey(p) {
  const phone = String((p.phones && p.phones[0]) || p.phone || '').replace(/[^\d+]/g, '');
  if (phone.replace(/\D/g, '').length >= 10) return `person:${phone}`;
  const email = String((p.emails && p.emails[0]) || p.email || '').trim().toLowerCase();
  if (email) return `person:${email}`;
  return `person:${text.slug(p.name || 'someone', 60)}`;
}

const reachable = (p) => !!((p.phones && p.phones.length) || p.phone || (p.emails && p.emails.length) || p.email);

// A Pipeline row for one person. kind: first_25, reconnect or referrals (kept in data for later tools).
function warmRow(p, { kind, textMsg, follow1, follow2, answer, fact, score, note, sample } = {}) {
  const phone = (p.phones && p.phones[0]) || p.phone || '';
  const email = (p.emails && p.emails[0]) || p.email || '';
  const links = {};
  if (phone) links.phone = phone;
  if (email) links.email = email;
  const row = {
    key: personKey(p),
    name: text.clip(p.name || 'Someone you know', 120),
    warm: true,
    source: kind === 'reconnect' ? 'Reconnect' : kind === 'referrals' ? 'Referral ask' : 'Your first 25',
    stage: 'found',
    links,
    msg: { dm: textMsg || '', follow1: follow1 || '', follow2: follow2 || '', ...(answer ? { answer } : {}) },
    facts: [fact].filter(Boolean).map((f) => text.clip(f, 160)).slice(0, 5),
    score: Math.max(1, Math.min(99, Math.round(score == null ? 60 : score))),
    data: { kind: kind || 'first_25', group: p.group || null, sample: !!sample },
  };
  // Calls and texts go to the phone; with only an email, the email way.
  if (phone) row.channel = 'call';
  else if (email) row.channel = 'email';
  if (note) row.note = text.clip(note, 1000);
  return row;
}

// Saves rows, best effort: one bad row never stops the rest. Returns how many were saved.
async function saveRows(ctx, rows) {
  if (!ctx.leads || typeof ctx.leads.upsert !== 'function') return 0;
  let n = 0;
  for (const r of rows) {
    try {
      await ctx.leads.upsert(r);
      n++;
    } catch {
      /* the Pipeline is best effort */
    }
  }
  return n;
}

// Every lead the member has, from every pack (list({ all: true }) on the harness).
async function allLeads(ctx) {
  if (!ctx.leads || typeof ctx.leads.list !== 'function') return [];
  try {
    return (await ctx.leads.list({ all: true, limit: 2000 })) || [];
  } catch {
    return [];
  }
}

const norm = (s) => String(s || '').toLowerCase().replace(/\(sample\)/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

// The lead a typed or picked name means: exact name, then the same first and last word, then a
// name that starts with what they typed. Lost leads count last.
function findByName(list, name) {
  const want = norm(name);
  if (!want) return null;
  const names = (l) => [l.name, l.company].map(norm).filter(Boolean);
  const order = (a, b) => Number(a.stage === 'lost') - Number(b.stage === 'lost');
  const pools = [
    (l) => names(l).includes(want),
    (l) => names(l).some((n) => n.split(' ')[0] === want.split(' ')[0] && n.split(' ').slice(-1)[0] === want.split(' ').slice(-1)[0]),
    (l) => want.length >= 3 && names(l).some((n) => n.startsWith(want) || want.startsWith(n)),
  ];
  for (const test of pools) {
    const hits = list.filter(test).sort(order);
    if (hits.length) return hits[0];
  }
  return null;
}

// A lead this pack saved (its upsert can move the stage); other packs' leads take update() only.
const isOwn = (lead) => !!lead && (lead.pack ? lead.pack === 'warm' : /^person:/.test(String(lead.key || '')));

// Which nudge is next for a contacted lead, and whether it's due now. Follows the harness rule:
// 3 days after the first message, 4 after the second, none after the third.
function nudgeDue(lead, now) {
  if (!lead || lead.stage !== 'contacted') return null;
  const touches = Math.max(1, Number(lead.touches) || 1);
  if (touches > 2) return null;
  if (lead.snoozeUntil && Date.parse(lead.snoozeUntil) > now) return null;
  let at = Date.parse(lead.nextAt || '');
  if (!Number.isFinite(at)) {
    const last = Date.parse(lead.lastTouchAt || lead.sentAt || '');
    if (!Number.isFinite(last)) return { n: touches, at: now, due: true, guessed: true };
    at = last + (touches === 1 ? 3 : 4) * DAY;
  }
  return { n: touches, at, due: at <= now };
}

const repliedWaiting = (l) => l && l.stage === 'replied' && !(l.answeredAt && Date.parse(l.answeredAt) >= Date.parse(l.repliedAt || 0));

// "Oct 12", "10/12", "2026-10-12", "3 days ago", "last week", "yesterday", "monday" -> ms, or null.
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function whenOf(s, now, tz) {
  const t = String(s || '').toLowerCase();
  if (!t.trim()) return null;
  const today = time.partsIn(now, tz);
  const at = (y, m, d) => {
    const ms = Date.UTC(y, m - 1, d, 12);
    return ms > now + DAY ? Date.UTC(y - 1, m - 1, d, 12) : ms;
  };
  let m = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/.exec(t);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], 12);
  m = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(t);
  if (m && +m[1] <= 12 && +m[2] <= 31) return m[3] ? Date.UTC(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[1] - 1, +m[2], 12) : at(today.y, +m[1], +m[2]);
  m = new RegExp(`\\b(${MONTHS.join('|')})[a-z]*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`).exec(t);
  if (m) return at(today.y, MONTHS.indexOf(m[1]) + 1, +m[2]);
  m = /\b(\d{1,2}|a|one|two|three|four|five|six|seven)\s+(day|days|week|weeks)\s+ago\b/.exec(t);
  if (m) {
    const n = { a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 }[m[1]] || Number(m[1]);
    return now - n * (/week/.test(m[2]) ? 7 : 1) * DAY;
  }
  if (/\byesterday\b/.test(t)) return now - DAY;
  if (/\btoday\b/.test(t)) return now;
  if (/\blast week\b/.test(t)) return now - 7 * DAY;
  const wd = time.WEEKDAYS.findIndex((d) => new RegExp(`\\b(last )?${d.toLowerCase()}\\b`).test(t));
  if (wd >= 0) {
    const nowWd = new Date(Date.UTC(today.y, today.m - 1, today.d)).getUTCDay();
    const back = (nowWd - wd + 7) % 7 || 7;
    return now - back * DAY;
  }
  return null;
}

// Pasted "who you messaged and when" lines: name, phone or email, and when (optional).
function parseMessaged(raw, now, tz) {
  const rows = C.parseLines(raw).filter((p) => p.name && !C.isBusiness(p));
  return rows.slice(0, 50).map((p) => {
    const note = p.notes.join(' ');
    const sent = whenOf(note, now, tz);
    return { ...p, note, sentAt: sent, days: sent == null ? null : Math.max(0, Math.floor((now - sent) / DAY)) };
  });
}

// Pasted names (one per line, a CSV or a .vcf export), in the member's order: people only, merged
// by phone or email. A name with no number or email still gets a text (it's in their phone already).
function peopleFrom(raw, max = 25) {
  const { kind, people } = C.parseAny(raw || '');
  const all = C.dedupe(people.filter((p) => p.name));
  const persons = all.filter((p) => !C.isBusiness(p));
  return {
    kind,
    read: people.length,
    businesses: all.length - persons.length,
    extra: Math.max(0, persons.length - max),
    people: persons.slice(0, max).map((p) => ({ name: p.name, first: p.first, phones: p.phones.slice(0, 2), emails: p.emails.slice(0, 2), phone: p.phones[0] || '', email: p.emails[0] || '', note: text.clip(text.oneLine(p.notes.join('. ')), 160) })),
  };
}

module.exports = { personKey, reachable, warmRow, saveRows, allLeads, findByName, isOwn, nudgeDue, repliedWaiting, whenOf, parseMessaged, peopleFrom, STAGES, DAY };
