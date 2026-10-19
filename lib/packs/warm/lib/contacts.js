// Contacts in, people out: reads a phone's vCard export (2.1, 3.0, 4.0), a Google or Outlook CSV,
// or pasted lines; cleans phones; merges duplicates by phone or email; drops businesses; then sorts
// each person into could buy, could refer or could advise using only what the member wrote.

const { text } = require('../../_kit');

// ---------- phones and names ----------

function phoneOf(raw, country = 'US') {
  const s = String(raw || '').replace(/^tel:/i, '').trim();
  const plus = s.startsWith('+');
  const d = s.replace(/\D/g, '');
  if (!d) return '';
  if (!plus && d.length === 10 && country === 'US') return `+1${d}`;
  if (!plus && d.length === 11 && d[0] === '1') return `+${d}`;
  if (plus) return `+${d}`;
  return d.length >= 7 ? d : '';
}

function showPhone(e164) {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164 || '');
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164 || '';
}

const BIZ = /\b(llc|inc|corp|co\.|company|pharmacy|pizza|dental|dentist|clinic|salon|bank|insurance|hotel|restaurant|auto|services?|store|shop|delivery|support|customer|hospital|office|school|church|gym|vet|veterinary|plumbing|repair|cleaners|takeout|uber|lyft|doordash|voicemail|hotline|help ?desk)\b/i;

function cleanName(s) {
  return text.oneLine(String(s || '').replace(/[“”"]/g, '').replace(/[‘’]/g, "'")).slice(0, 80);
}

// ---------- vCard ----------

function unfold(raw) {
  return String(raw || '').replace(/\r\n|\r/g, '\n').replace(/=\n/g, '=SOFTBREAK\n').replace(/\n[ \t]/g, '');
}

function qp(s) {
  const bytes = [];
  const str = s.replace(/=SOFTBREAK\n?/g, '');
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '=' && /^[0-9A-F]{2}$/i.test(str.slice(i + 1, i + 3))) {
      bytes.push(parseInt(str.slice(i + 1, i + 3), 16));
      i += 2;
    } else bytes.push(...Buffer.from(str[i]));
  }
  return Buffer.from(bytes).toString('utf8');
}

function unescapeV(s) {
  return String(s).replace(/\\n/gi, ' ').replace(/\\([,;:\\])/g, '$1');
}

function parseVcf(raw) {
  const people = [];
  const body = unfold(raw);
  const cards = body.split(/BEGIN:VCARD/i).slice(1).map((c) => c.split(/END:VCARD/i)[0]);
  for (const card of cards) {
    // QP soft breaks were kept so the value can be joined here.
    const lines = card.replace(/=SOFTBREAK\n/g, '=SOFTBREAK').split('\n').filter((l) => l.includes(':'));
    const p = { name: '', first: '', last: '', phones: [], emails: [], org: '', title: '', notes: [], labels: [], source: 'vcard' };
    for (const line of lines) {
      const i = line.indexOf(':');
      const head = line.slice(0, i);
      let val = line.slice(i + 1).trim();
      const parts = head.split(';');
      const prop = parts[0].replace(/^item\d+\./i, '').toUpperCase();
      if (/ENCODING=QUOTED-PRINTABLE|;QUOTED-PRINTABLE/i.test(head)) val = qp(val);
      val = unescapeV(val);
      if (prop === 'FN') p.name = cleanName(val);
      else if (prop === 'N') {
        const [last, first] = val.split(';');
        p.first = cleanName(first);
        p.last = cleanName(last);
      } else if (prop === 'TEL') {
        const ph = phoneOf(val);
        if (ph) p.phones.push(ph);
      } else if (prop === 'EMAIL') {
        if (/@/.test(val)) p.emails.push(val.toLowerCase());
      } else if (prop === 'ORG') p.org = cleanName(val.replace(/;+/g, ' '));
      else if (prop === 'TITLE') p.title = cleanName(val);
      else if (prop === 'NOTE') p.notes.push(text.oneLine(val));
      else if (prop === 'CATEGORIES') p.labels.push(...val.split(',').map((x) => x.trim()).filter(Boolean));
    }
    if (!p.name) p.name = [p.first, p.last].filter(Boolean).join(' ');
    people.push(p);
  }
  return people;
}

// ---------- CSV (Google new and old, Outlook, generic) ----------

function parseCsvText(raw) {
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  const s = String(raw || '').replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim()));
}

function parseCsv(raw) {
  const rows = parseCsvText(raw);
  if (rows.length < 2) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = (re) => head.map((h, i) => (re.test(h) ? i : -1)).filter((i) => i >= 0);
  const c = {
    name: col(/^(name|full name|display name)$/),
    first: col(/^(first name|given name)$/),
    last: col(/^(last name|family name|surname)$/),
    phone: col(/phone|mobile|cell|tel/).filter((i) => !/type|label/.test(head[i])),
    email: col(/e-?mail/).filter((i) => !/type|label/.test(head[i])),
    notes: col(/^notes?$/),
    org: col(/organi[sz]ation( 1)?( -)? ?name|^company$|^organization$/),
    title: col(/organi[sz]ation( 1)?( -)? ?title|^job title$|^title$/),
    labels: col(/^labels$|group membership|^categories$/),
  };
  const multi = (v) => String(v || '').split(':::').map((x) => x.trim()).filter(Boolean);
  return rows.slice(1).map((r) => {
    const get = (ix) => ix.map((i) => r[i]).filter((v) => v && String(v).trim());
    const p = {
      first: cleanName(get(c.first)[0]),
      last: cleanName(get(c.last)[0]),
      name: cleanName(get(c.name)[0]),
      phones: get(c.phone).flatMap(multi).map((x) => phoneOf(x)).filter(Boolean),
      emails: get(c.email).flatMap(multi).filter((x) => /@/.test(x)).map((x) => x.toLowerCase()),
      org: cleanName(get(c.org)[0]),
      title: cleanName(get(c.title)[0]),
      notes: get(c.notes).map((x) => text.oneLine(x)),
      labels: get(c.labels).flatMap(multi).map((x) => x.replace(/^\*\s*/, '')).filter((x) => !/^mycontacts$/i.test(x)),
      source: 'csv',
    };
    if (!p.name) p.name = [p.first, p.last].filter(Boolean).join(' ');
    return p;
  });
}

// ---------- pasted lines: "Maria Lopez, 512-555-0134, neighbor with 2 cars" ----------

const PHONE_RX = /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
const EMAIL_RX = /[^\s,;<>]+@[^\s,;<>]+\.[a-z]{2,}/i;

function parseLines(raw) {
  return String(raw || '').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !/^#/.test(l)).map((line) => {
    const phone = (PHONE_RX.exec(line) || [''])[0];
    const email = (EMAIL_RX.exec(line) || [''])[0];
    let rest = line.replace(phone, ' ').replace(email, ' ');
    const m = /^([^,;:|\-–(]+)[,;:|\-–(]?(.*)$/.exec(rest.trim());
    const name = cleanName(m ? m[1] : rest);
    const note = text.oneLine((m ? m[2] : '').replace(/^[\s,;:|\-–)]+/, '').replace(/[\s,;|]+$/, '').replace(/\s*,\s*,/g, ','));
    return { name, first: '', last: '', phones: phone ? [phoneOf(phone)].filter(Boolean) : [], emails: email ? [email.toLowerCase()] : [], org: '', title: '', notes: note ? [note] : [], labels: [], source: 'lines' };
  });
}

function detect(raw) {
  const s = String(raw || '');
  if (/BEGIN:VCARD/i.test(s)) return 'vcard';
  const first = s.replace(/^﻿/, '').split(/\r?\n/)[0] || '';
  if (/,/.test(first) && /(name|phone|e-?mail)/i.test(first) && !PHONE_RX.test(first)) return 'csv';
  return 'lines';
}

function parseAny(raw) {
  const kind = detect(raw);
  const list = kind === 'vcard' ? parseVcf(raw) : kind === 'csv' ? parseCsv(raw) : parseLines(raw);
  return { kind, people: list };
}

// ---------- merge duplicates (union-find on phone and email) ----------

function dedupe(people) {
  const parent = people.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const seen = new Map();
  people.forEach((p, i) => {
    for (const k of [...p.phones.map((x) => `p:${x}`), ...p.emails.map((x) => `e:${x}`)]) {
      if (seen.has(k)) parent[find(i)] = find(seen.get(k));
      else seen.set(k, i);
    }
  });
  const groups = new Map();
  people.forEach((p, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(p);
  });
  return [...groups.values()].map((g) => {
    const best = g.reduce((a, b) => (b.name.length > a.name.length ? b : a));
    return {
      ...best,
      phones: [...new Set(g.flatMap((x) => x.phones))],
      emails: [...new Set(g.flatMap((x) => x.emails))],
      notes: [...new Set(g.flatMap((x) => x.notes))],
      labels: [...new Set(g.flatMap((x) => x.labels))],
      org: g.map((x) => x.org).find(Boolean) || '',
      title: g.map((x) => x.title).find(Boolean) || '',
      merged: g.length,
    };
  });
}

function isBusiness(p) {
  const personal = p.first || /^[A-Z][a-z'.-]+(\s[A-Z][a-z'.-]+){1,3}$/.test(p.name);
  if (!p.name && p.org) return true;
  if (BIZ.test(p.name) && !p.first) return true;
  return !personal && !!p.org;
}

// ---------- sort: could buy, could refer, could advise (only from the member's words) ----------

const CLOSE = /\b(mom|dad|mother|father|sister|brother|aunt|uncle|cousin|grandma|grandpa|family|best friend|close friend|friend|roommate)\b/i;
const NEAR = /\b(neighbou?r|coworker|co-worker|old boss|boss|classmate|teammate|church|gym|club|college|school|kid'?s|team mom|team dad)\b/i;
const BUY = /\b(asked|interested|needs?|wants?|looking for|been meaning|complain\w*|has (a|an|two|2|three|3)|owns? (a|an) (car|truck|suv|home|house|dog|cat|boat)|new (house|home|baby|car|puppy)|just (moved|bought|had)|asking about|busy|hates?)\b/i;
const REFER = /\b(knows (everyone|everybody|a lot of people)|connector|realtor|real estate|agent|hoa|pta|coach|teacher|pastor|barber|hairdresser|stylist|bartender|manager|organizer|admin|runs the|group|facebook group|neighborhood|nextdoor|mail carrier|front desk|receptionist|works at)\b/i;
const ADVISE = /\b((owns|runs|started) (a|an|her|his|their) ([a-z-]+ )?(business|company|shop|salon|studio|agency|store|firm|bakery|gym|practice)|business owner|founder|entrepreneur|self[- ]employed|mentor|accountant|cpa|lawyer|attorney|marketing|consultant|sales (rep|manager)|been doing this)\b/i;

function sortPerson(p, offerWords = []) {
  const note = [p.notes.join('. '), p.title, p.org, p.labels.join(' ')].filter(Boolean).join('. ');
  const words = offerWords.filter((w) => w.length > 3);
  const offerHit = words.find((w) => new RegExp(`\\b${w.replace(/[^a-z0-9]/gi, '')}`, 'i').test(note));
  const buy = BUY.test(note) || !!offerHit;
  const refer = REFER.test(note);
  const advise = ADVISE.test(note);
  let group = 'refer';
  let why = note ? 'Your note does not say they need it, so ask who they know.' : 'No notes yet. Everyone knows someone, so ask who they know.';
  if (buy) {
    group = 'buy';
    const m = (note.match(BUY) || [offerHit || ''])[0];
    why = `You wrote "${text.clip(note, 70)}"${m ? `, so they may need it themselves` : ''}.`;
  } else if (advise) {
    group = 'advise';
    why = `You wrote "${text.clip(note, 70)}". They've done this before, so ask for advice.`;
  } else if (refer) {
    why = `You wrote "${text.clip(note, 70)}". They know a lot of people.`;
  }
  const close = CLOSE.test(note) ? 2 : NEAR.test(note) ? 1 : 0;
  const reach = p.phones.length ? 2 : p.emails.length ? 1 : 0;
  const score = reach * 2 + (note ? 2 : 0) + close * 2 + (group === 'buy' ? 3 : group === 'advise' ? 1 : refer ? 2 : 0) + (p.labels.some((l) => /starred|favou?rite/i.test(l)) ? 1 : 0);
  return { group, why: text.plain(why), note: text.plain(note), close, reach, score };
}

const GROUPS = { buy: 'Could buy', refer: 'Could refer', advise: 'Could advise' };

module.exports = { phoneOf, showPhone, parseVcf, parseCsv, parseLines, parseAny, detect, dedupe, isBusiness, sortPerson, GROUPS, parseCsvText };
