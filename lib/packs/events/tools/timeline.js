// Day-of timeline (the events pack's own tool): the event type, the start time and the vendor list
// give a timeline with one owner per row, the vendor contact sheet and the day-of checklist in one
// printable page, the week-before messages, a vendor CSV and countdown reminders for the calendar.
// Wedding order and lengths come from Zola's sample reception timeline and its vendor arrivals from
// Zola's sample weekend timeline; the method (work from the fixed points, one owner per cue, arrive
// first, a copy for every vendor) from EventPlanning.com. Party, shower and work event programs and
// the arrivals no source gives are our judgment, and every default arrival prints "(confirm)".
// Facts live in data/niche.json `timeline` (sources: research/niches/events.json).

const { views, files, save, time, text, color } = require('../../_kit');
const C = require('../../_kit/common');

const { plain, clip } = text;
const esc = (s) => files.esc(plain(s == null ? '' : String(s)));
const TYPES = ['Wedding', 'Birthday or party', 'Shower or engagement party', 'Work event'];
const pad = (n) => String(n).padStart(2, '0');
const DAY_MIN = 1440;

// ---------- clock times ----------

// 990 -> "4:30pm", 1470 -> "12:30am"
function clock(min) {
  const m = ((Math.round(min) % DAY_MIN) + DAY_MIN) % DAY_MIN;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h % 12 || 12}${mm ? `:${pad(mm)}` : ''}${h < 12 ? 'am' : 'pm'}`;
}

// 990 -> "16:30" (for the calendar file)
function hhmm(min) {
  const m = ((Math.round(min) % DAY_MIN) + DAY_MIN) % DAY_MIN;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

const LEAD_WORDS = /^(?:(?:arrives?|arrival|arriving|at|by|from|set ?-?up|load ?-?in|starts?|starting|begins?|opens?|doors?|ceremony|time)\b[\s:]*)+/i;
const CLOCK_IN = /\b(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)|\d{1,2}:\d{2}|noon)(?![\w:])/i;

// "4:30pm", "16:30", "4 pm", "noon" -> { min, sure, bare }. sure is false when "4:30" could be am or pm;
// bare is a lone number ("4"), which only the start and end fields read as a time.
function parseClock(raw) {
  const s = plain(raw == null ? '' : String(raw)).toLowerCase().trim().replace(LEAD_WORDS, '').trim();
  if (!s) return null;
  if (/^noon$/.test(s)) return { min: 720, sure: true, bare: false };
  if (/^midnight$/.test(s)) return { min: DAY_MIN, sure: true, bare: false };
  const m = s.match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?\s?m\.?|p\.?\s?m\.?|a|p)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const mm = Number(m[2] || 0);
  const ap = m[3] ? m[3][0] : '';
  if (h > 23 || mm > 59 || (ap && (h < 1 || h > 12))) return null;
  if (ap === 'p' && h < 12) h += 12;
  if (ap === 'a' && h === 12) h = 0;
  return { min: h * 60 + mm, sure: !!ap || h === 0 || h > 12, bare: !ap && m[2] == null };
}

// An am-or-pm time read as whichever is nearer the time we expected.
function nearest(t, target) {
  if (t.sure) return t.min;
  const alt = t.min >= 720 ? t.min - 720 : t.min + 720;
  return Math.abs(alt - target) < Math.abs(t.min - target) ? alt : t.min;
}

// The end time after the start: past midnight when it reads earlier.
function after(t, start) {
  const cands = t.sure ? [t.min] : [t.min, t.min >= 720 ? t.min - 720 : t.min + 720];
  let best = null;
  for (let c of cands) {
    while (c <= start) c += DAY_MIN;
    if (best == null || c < best) best = c;
  }
  return best;
}

// ---------- vendors ----------

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
const PHONE = /(?:\+?1[\s.-]?)?(?:\(\d{3}\)\s?|\d{3}[\s.-])?\d{3}[\s.-]\d{4}\b/;
const PERSON = /^[A-Za-z][A-Za-z.' ]{0,40}$/;
const regex = (src) => (src ? new RegExp(src, 'i') : null);

function rolesOf(T) {
  return T.roles.map((r) => ({ ...r, wordsRe: r.words ? new RegExp(`^(?:${r.words})$`, 'i') : null, matchRe: regex(r.match) }));
}

// "Florist, Bloom Studio, Kim, 555-0103, 1pm" or "Photographer: Lens and Light (Ana) 555-0104 arrives 1pm"
// -> { role, name, contact, phone, email, time, notes }. The role word is optional: it is read from the
// business name when it's missing ("Bloom Studio" is a florist), else "Other vendor".
function parseVendor(line, roles) {
  let s = plain(line).trim();
  const v = {};
  const em = s.match(EMAIL);
  if (em) {
    v.email = em[0];
    s = s.replace(em[0], ' ');
  }
  const ph = s.match(PHONE);
  if (ph) {
    v.phone = ph[0].trim();
    s = s.replace(ph[0], ' ');
  }
  const paren = s.match(/\(([^)]{2,40})\)/);
  if (paren && PERSON.test(paren[1].trim())) {
    v.contact = paren[1].trim();
    s = s.replace(paren[0], ' ');
  }
  const parts = s
    .split(/\s*[,|\t]\s*|\s+-\s+|:\s+/)
    .map((p) => p.replace(/\s+/g, ' ').replace(/^[\s\-|,;:]+|[\s\-|,;:]+$/g, ''))
    .filter((p) => /[a-z0-9]/i.test(p));
  const rest = [];
  const near = []; // lowercase words next to the time ("delivers 10am") go to the notes; a name stays in place
  for (const p of parts) {
    if (/^(phone|cell|mobile|tel|email|e-mail|contact)$/i.test(p)) continue;
    const whole = parseClock(p);
    if (!v.time && whole && !whole.bare) {
      v.time = whole;
      continue;
    }
    const inside = !v.time && p.match(CLOCK_IN);
    if (inside) {
      const t = parseClock(inside[1]);
      if (t) {
        v.time = t;
        const left = p.replace(inside[0], ' ').replace(LEAD_WORDS, '').replace(/\b(arrives?|arrival|at|by|opens?|setup|set up)\b/gi, ' ').replace(/\s+/g, ' ').replace(/^[\s\-|,;:]+|[\s\-|,;:]+$/g, '');
        if (/^[A-Z0-9]/.test(left)) rest.push(left);
        else if (/[a-z0-9]/i.test(left)) near.push(left);
        continue;
      }
    }
    rest.push(p);
  }
  // A role word on its own ("Florist", "DJ") names the role; a business name never does.
  const first = rest.length > 1 ? rest[0].replace(/[:.]+$/, '') : '';
  let role = first ? roles.find((r) => r.wordsRe && r.wordsRe.test(first)) : null;
  if (role) rest.shift();
  else role = roles.find((r) => r.matchRe && r.matchRe.test(rest.join(' '))) || roles.find((r) => r.id === 'other');
  v.role = role;
  v.name = clip(rest.shift() || role.label, 80);
  // A role word later in the line ("Bloom Studio - florist - Kim") is the role again, not a name.
  for (let i = rest.length - 1; i >= 0; i--) if (roles.some((r) => r.wordsRe && r.wordsRe.test(rest[i]))) rest.splice(i, 1);
  if (!v.contact && rest[0] && PERSON.test(rest[0]) && rest[0].split(' ').length <= 3) v.contact = rest.shift();
  if (rest.length || near.length) v.notes = clip([...rest, ...near].join('; '), 160);
  return v;
}

// "Kim" for a contact, "Rev. Cole" or "Dana" for an officiant named alone, else "Bloom Studio team".
const TITLE = /^(rev|dr|pastor|father|rabbi|imam|judge|mr|mrs|ms|mx)(\.?)\s+(.+)$/i;
function greetOf(v) {
  if (v.contact) return C.firstWord(v.contact);
  const t = v.name.match(TITLE);
  if (t) return `${t[1]}${t[2]} ${t[3].trim().split(/\s+/).pop()}`;
  if (v.role.id === 'officiant' && PERSON.test(v.name) && v.name.split(' ').length <= 3) return C.firstWord(v.name);
  return `${v.name} team`;
}

// ---------- the timeline ----------

// Flex rows stretch (or shrink to their minimum) so the program fills the time between the start and
// the end; returns the rows with their minutes and how far over the end the program still runs.
function fit(program, minutes) {
  const rows = program.map((r) => ({ ...r }));
  let diff = minutes - rows.reduce((n, r) => n + r.minutes, 0);
  const flex = rows.filter((r) => r.flex).sort((a, b) => a.flex - b.flex);
  if (diff > 0 && flex[0]) {
    flex[0].minutes += diff;
    diff = 0;
  }
  for (const r of flex) {
    if (diff >= 0) break;
    const cut = Math.min(r.minutes - (r.min || 15), -diff);
    r.minutes -= cut;
    diff += cut;
  }
  return { rows, over: diff < 0 ? -diff : 0 };
}

function typeOf(input) {
  return TYPES.includes(input.event_type) ? input.event_type : 'Wedding';
}

function build(T, input, me) {
  const type = typeOf(input);
  const wedding = type === 'Wedding';
  const roles = rolesOf(T);
  const notes = [];
  const warnings = [];

  const st = parseClock(input.start);
  if (!st) throw new Error('Add the start time, like "4:30pm". For a wedding, use the ceremony time.');
  const S = st.sure ? st.min : nearest(st, 845);
  if (!st.sure) notes.push(`Read the start time "${plain(input.start)}" as ${clock(S)}. Add am or pm to be sure.`);

  const ceremony = wedding ? Math.max(10, Math.min(120, parseInt(input.ceremony, 10) || T.wedding.ceremony)) : 0;
  const R = S + ceremony;
  const program = wedding ? T.wedding.reception : T.programs[type].rows;
  const usual = program.reduce((n, r) => n + r.minutes, 0);
  let E = R + usual;
  const et = input.end ? parseClock(input.end) : null;
  if (input.end && !et) warnings.push(`Couldn't read the end time "${plain(input.end)}", so the program uses the usual length.`);
  if (et) {
    E = after(et, R);
    if (!et.sure) notes.push(`Read the end time "${plain(input.end)}" as ${clock(E)}.`);
    if (E - R > 12 * 60) warnings.push(`The program runs ${Math.round((E - R) / 60)} hours: check the end time.`);
  }
  const { rows: fitted, over } = fit(program, E - R);
  if (over) warnings.push(`At the usual lengths the program runs ${over} minutes past ${clock(E)}. Shorten or drop a moment, or ask the venue for more time.`);
  const programEnd = E + over;

  // Vendors, with each arrival typed or the usual one for its role (marked "confirm").
  const vendors = C.linesOf(input.vendors, 30).map((l) => parseVendor(l, roles));
  const rel = (role) => (wedding ? role.wedding : role.party);
  for (const v of vendors) {
    if (v.role.venue) continue;
    const want = S + rel(v.role);
    v.at = v.time ? nearest(v.time, want) : want;
    v.confirm = !v.time;
  }
  const onSite = vendors.filter((v) => !v.role.venue && !v.role.offsite);
  const firstIn = onSite.length ? Math.min(...onSite.map((v) => v.at)) : null;
  const lead = (!wedding && T.programs[type].lead) || T.no_vendor_lead;
  let arrive = firstIn != null ? firstIn - T.coordinator_lead : S - lead;
  arrive = Math.min(arrive, S - T.latest_arrival);
  const venue = vendors.find((v) => v.role.venue);
  if (venue) {
    venue.at = venue.time ? nearest(venue.time, arrive) : arrive;
    venue.confirm = !venue.time;
    if (venue.time && venue.at > arrive) {
      const early = onSite.filter((v) => v.at < venue.at);
      if (early.length) warnings.push(`${C.clip(early.map((v) => v.name).join(', '), 120)} ${early.length === 1 ? 'arrives' : 'arrive'} before the venue opens at ${clock(venue.at)}: move ${early.length === 1 ? 'that time' : 'those times'} or ask the venue to open earlier.`);
      arrive = venue.at;
    }
  }
  const afterRows = (!wedding && T.programs[type].after) || T.after;
  const after0 = programEnd;
  const leave = after0 + afterRows[afterRows.length - 1].after;

  const coord = me.first ? `${me.first} (coordinator)` : 'Coordinator';
  const byRole = {};
  for (const v of vendors) (byRole[v.role.id] = byRole[v.role.id] || []).push(v);
  const roleLabel = Object.fromEntries(roles.map((r) => [r.id, r.label]));
  const whoText = (ids) => {
    const names = [];
    let fallback = '';
    for (const id of ids) {
      if (id === 'you') names.push(coord);
      else if (byRole[id]) names.push(byRole[id].map((v) => v.name).join(' and '));
      else if (roleLabel[id]) fallback = fallback || roleLabel[id];
      else names.push(id);
    }
    if (!names.length && fallback) names.push(fallback);
    return [...new Set(names)].join(', ');
  };

  const rows = [];
  let seq = 0;
  const add = (r) => rows.push({ ...r, seq: seq++ });
  add({ at: arrive, what: 'Coordinator arrives and walks the space against this timeline', who: coord, kind: 'you' });
  if (venue) add({ at: venue.at, what: 'Venue opens for setup', who: venue.contact ? `${venue.name} (${venue.contact})` : venue.name, note: venue.confirm ? '(confirm)' : '', kind: 'vendor' });
  for (const v of vendors) {
    if (v.role.venue) continue;
    const step = v.role.id === 'beauty' ? 'starts where the couple gets ready' : v.role.id === 'transport' ? 'pickup' : v.role.setup ? 'arrival and setup' : 'arrival';
    add({ at: v.at, what: `${v.role.label}: ${step}`, who: v.contact ? `${v.name} (${v.contact})` : v.name, note: [v.confirm ? '(confirm)' : '', v.notes || ''].filter(Boolean).join(' '), kind: 'vendor' });
  }
  const first = !!input.first_look && input.first_look !== 'false';
  const before = wedding ? T.wedding.before : T.programs[type].before;
  for (const b of before) {
    if (b.if === 'first_look' && !first) continue;
    if (b.if === 'no_first_look' && first) continue;
    add({ at: S + b.at, what: b.what, who: whoText(b.who), ids: b.who, kind: b.who.includes('you') && b.who.length === 1 ? 'you' : b.fixed ? 'fixed' : 'program' });
  }
  if (wedding) add({ at: S, end: R, what: `${T.wedding.ceremony_row.what} (${ceremony} minutes)`, who: whoText(T.wedding.ceremony_row.who), ids: T.wedding.ceremony_row.who, kind: 'fixed' });
  let at = R;
  for (const r of fitted) {
    const extra = wedding && !first && r.no_first_look ? r.no_first_look : '';
    add({ at, end: at + r.minutes, what: r.what, who: whoText(r.who), ids: r.who, note: [r.flex === 1 ? 'Flex: stretches or shrinks to fit' : '', extra].filter(Boolean).join('. '), kind: r.fixed ? 'fixed' : 'program' });
    at += r.minutes;
  }
  for (const a of afterRows) {
    const ids = a.who.filter((id) => id !== 'venue' || venue);
    add({ at: after0 + a.after, ...(a.minutes ? { end: after0 + a.after + a.minutes } : {}), what: a.what, who: whoText(ids.length ? ids : ['you']), kind: a.who.length === 1 ? 'you' : 'program' });
  }
  rows.sort((a, b) => a.at - b.at || a.seq - b.seq);

  // Checks the member can act on before the day.
  const guestsIn = wedding ? S - T.wedding.guests_before : S;
  for (const v of onSite) {
    if (!v.role.setup && !['photo', 'video', 'officiant'].includes(v.role.id)) continue;
    const due = wedding && v.role.reception ? R : guestsIn;
    if (v.at > due) warnings.push(`${v.name} arrives at ${clock(v.at)}, after ${due === R && wedding ? 'the reception starts' : 'the guests'}: check the time.`);
  }
  // A vendor on a row before they arrive ("First look photos" at 2pm, the photographer at 3pm).
  for (const v of onSite) {
    const firstRow = rows.find((r) => r.ids && r.ids.includes(v.role.id));
    if (firstRow && v.at > firstRow.at && !warnings.some((w) => w.startsWith(`${v.name} arrives`))) warnings.push(`${v.name} arrives at ${clock(v.at)}, after "${firstRow.what}" at ${clock(firstRow.at)}: check the time.`);
  }
  const span = leave - arrive;
  const booked = Math.max(1, Math.min(18, parseInt(input.hours, 10) || T.hours[type]));
  if (span > booked * 60) warnings.push(`Your day runs ${hoursText(span)}, from ${clock(arrive)} to ${clock(leave)}, and you're booked for ${booked}. Ask the earliest vendor about a later arrival, or quote the extra hours.`);
  const noPhone = vendors.filter((v) => !v.phone).map((v) => v.name);
  if (noPhone.length) warnings.push(`No phone number for ${C.clip(text.list(noPhone), 160)}: add one before the day.`);
  const guessed = vendors.filter((v) => v.confirm).length;
  if (guessed) notes.push(`${guessed} arrival ${guessed === 1 ? 'time is the usual one' : 'times are the usual ones'} for the role, marked (confirm). Confirm each when you call the vendor.`);
  if (!vendors.length) warnings.push('No vendors listed: add one per line to get the contact sheet and their messages.');

  return { type, wedding, S, R, E: programEnd, arrive, leave, span, booked, ceremony, rows, vendors, venue, coord, notes, warnings, first };
}

function hoursText(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h} ${h === 1 ? 'hour' : 'hours'}${m ? ` ${m} minutes` : ''}`;
}

// ---------- the printable page ----------

function pageCss(p) {
  return `@page{size:Letter;margin:0.5in}
:root{--p:${p.primary};--on:${p.onPrimary};--ink:${p.ink};--s:${p.surface};--m:${p.muted};--l:${p.line}}
*{box-sizing:border-box}
body{margin:0;background:var(--s);color:var(--ink);font:15px/1.5 Inter,'Helvetica Neue',Arial,sans-serif}
.sheet{max-width:880px;margin:20px auto;background:#fff;border-radius:14px;padding:28px 30px;box-shadow:0 2px 10px rgba(0,0,0,.06)}
.eyebrow{font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--p)}
h1{font-size:28px;line-height:1.15;margin:4px 0 8px}h2{font-size:17px;margin:22px 0 8px;color:var(--p)}
.facts{display:flex;flex-wrap:wrap;gap:4px 18px;color:var(--m);font-size:14px;margin:0 0 12px;padding:0;list-style:none}
table{width:100%;border-collapse:collapse;font-size:14px}
th{text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--m);border-bottom:2px solid var(--l);padding:6px 8px}
td{border-bottom:1px solid var(--l);padding:8px;vertical-align:top}
td.t,td.ph{white-space:nowrap}td.t{font-weight:700;width:104px}td.t span{display:block;font-weight:400;color:var(--m);font-size:12px}
tr.you td{background:var(--s)}tr.fixed td.w{font-weight:700}
.note{color:var(--m);font-size:13px}.confirm{color:#8a5300;font-weight:600}
.warn{background:#fff6e5;border-left:4px solid #d99a00;border-radius:8px;padding:10px 14px;margin:10px 0}.warn li{margin:2px 0}
.box{background:var(--s);border-radius:10px;padding:12px 14px;margin:12px 0}
ul.check{list-style:none;padding:0;margin:4px 0 10px}
ul.check li{position:relative;padding:7px 0 7px 32px;border-bottom:1px solid var(--l)}
ul.check li:before{content:"";position:absolute;left:4px;top:10px;width:15px;height:15px;border:2px solid var(--m);border-radius:4px}
footer{margin-top:18px;font-size:12px;color:var(--m)}
@media (max-width:640px){
.sheet{margin:0 0 12px;border-radius:0;padding:20px 16px;box-shadow:none}
h1{font-size:24px}
table.stack thead{display:none}
table.stack,table.stack tbody,table.stack tr,table.stack td{display:block;width:100%}
table.stack tr{border-bottom:1px solid var(--l);padding:8px 0}
table.stack td{border:0;padding:2px 0}
table.stack td.t{width:auto}table.stack td.t span{display:inline;margin-left:6px}
table.stack td.lab:before{content:attr(data-label) ": ";color:var(--m);font-size:12px}
table.stack td.lab:empty{display:none}
}
@media print{body{background:#fff}.sheet{box-shadow:none;margin:0;padding:0;max-width:none;border-radius:0;break-after:page}.sheet:last-child{break-after:auto}tr{break-inside:avoid}}`;
}

function noteHtml(note) {
  if (!note) return '';
  return esc(note).replace('(confirm)', '<span class="confirm">(confirm)</span>');
}

function pageHtml(T, o) {
  const facts = [o.dateLong, o.venueName, o.guests ? `${o.guests} guests` : '', `${o.wedding ? 'Ceremony' : 'Start'} ${clock(o.S)}`, `Ends ${clock(o.E)}`].filter(Boolean);
  const warn = o.warnings.length ? `<div class="warn"><strong>Check before you send</strong><ul>${o.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>` : '';
  const rows = o.rows
    .map((r) => `<tr class="${r.kind}"><td class="t" data-label="Time">${esc(r.time)}${r.ends ? `<span>to ${esc(r.ends)}</span>` : ''}</td><td class="w" data-label="What">${esc(r.what)}</td><td class="lab" data-label="Who">${esc(r.who)}</td><td class="note lab" data-label="Notes">${noteHtml(r.note)}</td></tr>`)
    .join('\n');
  const vrows = [
    { role: 'Day-of coordinator', name: o.business || o.coord, contact: o.first || '', phone: o.phone || '', email: '', arrives: o.arriveText, confirm: false, notes: '' },
    ...o.vendors,
  ]
    .map((v) => `<tr><td class="w" data-label="Role">${esc(v.role)}</td><td class="lab" data-label="Business">${esc(v.name)}</td><td class="lab" data-label="Contact">${esc(v.contact || '')}</td><td class="lab ph" data-label="Phone">${esc(v.phone || '')}</td><td class="lab" data-label="Email">${esc(v.email || '')}</td><td class="lab" data-label="Arrives">${esc(v.arrives || '')}${v.confirm ? ' <span class="confirm">(confirm)</span>' : ''}</td><td class="note lab" data-label="Notes">${esc(v.notes || '')}</td></tr>`)
    .join('\n');
  const checklist = o.checklist.map((s) => `<h2>${esc(s.title)}</h2><ul class="check">${s.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`).join('\n');
  const from = [...new Set(T.sources.map((s) => s.publisher))];
  const head = (sub) => `<header><div class="eyebrow">${esc(o.business || 'Day-of coordination')}</div><h1>${esc(o.title)}</h1><p class="note">${esc(sub)}</p><ul class="facts">${facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></header>`;
  const body = `<section class="sheet">
${head('Timeline')}
${warn}
<table class="stack"><thead><tr><th>Time</th><th>What</th><th>Who</th><th>Notes</th></tr></thead><tbody>
${rows}
</tbody></table>
${o.rain ? `<div class="box"><strong>Rain plan:</strong> ${esc(o.rain)}</div>` : ''}
<footer>Times marked (confirm) are the usual ones for that vendor: confirm each one. ${o.wedding ? "Order and lengths from Zola's sample wedding timelines; " : 'The program is a starting point to adjust; '}method from ${esc(text.list(from.filter((f) => f !== 'Zola')))} (checked ${esc(time.longDate(T.checked || '2026-10-19'))}). ${o.phone ? `Questions on the day: ${esc(o.coord)}, ${esc(o.phone)}.` : ''}</footer>
</section>
<section class="sheet">
${head('Vendor contact sheet')}
<table class="stack"><thead><tr><th>Role</th><th>Business</th><th>Contact</th><th>Phone</th><th>Email</th><th>Arrives</th><th>Notes</th></tr></thead><tbody>
${vrows}
</tbody></table>
<footer>Every vendor gets this sheet with the timeline a week before, and the final version the day before.</footer>
</section>
<section class="sheet">
${head('Day-of checklist')}
${checklist}
<footer>Tick each box as you go.</footer>
</section>`;
  return files.htmlDoc({ title: `${o.title}: day-of timeline`, css: pageCss(o.palette), body, description: `Timeline, vendor contact sheet and day-of checklist for ${o.title}` });
}

// ---------- the tool ----------

function timelineTool(N) {
  const T = { ...N.timeline, checked: N.checked };
  return {
    name: `${N.id}.build_timeline`,
    title: 'Build the day-of timeline',
    description: 'The event type, the start time and your vendor list give a timeline with one owner per row, the vendor contact sheet and a day-of checklist on one printable page, the week-before messages, a vendor CSV and countdown reminders for your calendar.',
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 1,
    timeoutSec: 30,
    input: {
      type: 'object',
      required: ['start', 'vendors'],
      properties: {
        client: { type: 'string', maxLength: 120, title: "Client's name (optional)", description: 'Pick from your Pipeline or type their name' },
        event_type: { type: 'string', enum: TYPES, default: 'Wedding', title: 'Kind of event' },
        event_name: { type: 'string', maxLength: 80, title: 'Event name (optional)', description: `Like "Maya and Jordan's wedding"` },
        date: { type: 'string', format: 'date', title: 'Event date (optional)', description: 'Adds the countdown reminders for your calendar' },
        venue: { type: 'string', maxLength: 120, title: 'Venue (optional)', description: 'Like "Rosewood Hall, 400 Mill St"' },
        start: { type: 'string', maxLength: 20, title: 'Start time', description: 'Like "4:30pm". For a wedding, the ceremony time.' },
        end: { type: 'string', maxLength: 20, title: 'When guests leave (optional)', description: "Like \"10:30pm\": the venue's end time. Left empty, the usual length for this kind of event." },
        guests: { type: 'integer', minimum: 1, maximum: 2000, title: 'Guests (optional)' },
        vendors: { type: 'string', format: 'textarea', maxLength: 4000, title: 'Vendors, one per line', description: 'Role, business, contact, phone, arrival time. Like "Florist, Bloom Studio, Kim, 555-0103, 1pm". A missing time gets the usual one for the role, marked (confirm).' },
        ceremony: { type: 'integer', minimum: 10, maximum: 120, default: 30, title: 'Ceremony length in minutes (weddings)' },
        first_look: { type: 'boolean', default: false, title: 'First look photos before the ceremony (weddings)' },
        rain_plan: { type: 'string', maxLength: 300, title: 'Rain plan (optional)', description: 'Like "Ceremony moves into the barn". Printed on the timeline.' },
        hours: { type: 'integer', minimum: 1, maximum: 18, title: "Hours you're booked for on the day (optional)", description: 'Left empty: 12 for a wedding or work event, 6 for a party or shower' },
        business: { type: 'string', maxLength: 80, title: 'Business name (optional)' },
        phone: { type: 'string', maxLength: 40, title: 'Your phone (optional)' },
        color: { type: 'string', maxLength: 7, title: 'Brand color (optional)', description: 'A hex color like #2a6f6b' },
      },
    },
    output: {
      type: 'object',
      required: ['title', 'event', 'rows', 'vendors', 'checklist', 'messages', 'span', 'warnings', 'notes', 'file', 'csv', 'saved'],
      properties: {
        title: { type: 'string' },
        client: { type: 'string' },
        event: { type: 'object' },
        rows: { type: 'array' },
        vendors: { type: 'array' },
        checklist: { type: 'array' },
        messages: { type: 'array' },
        countdown: { type: 'array' },
        span: { type: 'object' },
        warnings: { type: 'array' },
        notes: { type: 'array' },
        file: { type: 'object' },
        csv: { type: 'object' },
        ics: { type: 'object' },
        saved: { type: 'object' },
        sources: { type: 'array' },
      },
    },
    async run(input, ctx) {
      const me = C.who(ctx, input);
      const b = build(T, input, me);
      const kind = T.kinds[b.type];
      const clientName = clip(plain(input.client || ''), 120);
      const greet = C.firstWord(clientName);
      const named = plain(input.event_name || '');
      const title = clip(named || (greet ? `${C.possessive(greet)} ${kind}` : b.type), 80);
      const forClient = named || `your ${kind}`;
      const forVendor = named || (greet ? `${C.possessive(greet)} ${kind}` : `the ${kind}`);
      const venueName = plain(input.venue || '') || (b.venue && b.venue.name !== b.venue.role.label ? b.venue.name : '');
      const venueShort = venueName.split(',')[0];
      const today = time.today(ctx);
      const date = /^\d{4}-\d{2}-\d{2}$/.test(String(input.date || '')) ? String(input.date) : '';
      const dateLong = date ? `${time.WEEKDAYS[time.weekdayOf(date)]}, ${time.longDate(date)}` : '';
      const warnings = [...b.warnings];
      const notes = [...b.notes];
      if (date && date < today) warnings.push('The event date is in the past: check it.');
      const daysOut = date ? Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000) : null;
      if (daysOut != null && daysOut >= 0 && daysOut <= 7) notes.push(`The event is ${daysOut === 0 ? 'today' : daysOut === 1 ? 'tomorrow' : `${daysOut} days away`}: send the final timeline today.`);
      notes.push(b.wedding ? "Reception order and lengths follow Zola's sample timeline. Drop or move any moment the couple doesn't want." : "This program is our starting point, built on EventPlanning.com's run of show method. Move or drop any row to fit the host's plan.");

      const rows = b.rows.map((r) => ({ time: clock(r.at), ...(r.end != null ? { ends: clock(r.end) } : {}), what: r.what, who: r.who, ...(r.note ? { note: r.note } : {}), kind: r.kind, at: r.at }));
      const intro = me.first ? `it's ${me.first}, the day-of coordinator` : me.business ? `it's ${me.business}, the day-of coordinator` : "I'm the day-of coordinator";
      const reach = me.phone ? ` I'm at ${me.phone}.` : '';
      const vendors = b.vendors.map((v) => {
        const vg = greetOf(v);
        const when = clock(v.at);
        // The venue opens its doors, hair and makeup starts where the couple gets ready, transport picks up.
        const say = v.role.venue
          ? { set: `the doors opening for setup at ${when}`, ask: `on the doors opening for setup at ${when}`, day: `the doors open for setup at ${when}`, confirm: 'the setup and end times, where vendors load in and park, and the best number to reach your team on the day' }
          : v.role.id === 'beauty'
            ? { set: `you starting at ${when}`, ask: `for you to start at ${when}`, day: `you start at ${when}`, confirm: 'the start time, the address and the best number to reach you on the day' }
            : v.role.id === 'transport'
              ? { set: `the pickup at ${when}`, ask: `the pickup for ${when}`, day: `the pickup is at ${when}`, confirm: 'the pickup time and place, and the best number to reach you on the day' }
              : { set: `you arriving at ${when}`, ask: `for you to arrive at ${when}`, day: `you arrive at ${when}`, confirm: 'your arrival time, what you need on site (power, parking, a table) and the best number to reach you on the day' };
        const plan = `${v.confirm ? `I've planned ${say.ask}. Does that work?` : `I have ${say.set}.`} The full timeline is attached. Could you confirm ${say.confirm}?`;
        const week = `Hi ${vg}, ${intro} for ${forVendor}${dateLong ? ` on ${dateLong}` : ''}${venueShort ? ` at ${venueShort}` : ''}. ${plan}${reach}`;
        const tomorrow = say.day;
        const dayBefore = `Hi ${vg}, confirming tomorrow: ${tomorrow}. I'll be ${venueShort ? `at ${venueShort}` : 'there'} from ${clock(b.arrive)}${me.phone ? `, at ${me.phone} if anything comes up` : ''}. See you then!`;
        return {
          role: v.role.label,
          name: v.name,
          ...(v.contact ? { contact: v.contact } : {}),
          ...(v.phone ? { phone: v.phone } : {}),
          ...(v.email ? { email: v.email } : {}),
          arrives: when,
          at: v.at,
          confirm: !!v.confirm,
          ...(v.notes ? { notes: v.notes } : {}),
          week_message: plain(week),
          day_message: plain(dayBefore),
        };
      });
      const messages = [
        {
          label: 'To your client, a week before',
          when: date ? time.shortDate(time.addDays(date, -7)) : 'A week before',
          text: plain(`Hi ${greet || 'there'}, here's the final plan for ${forClient}${dateLong ? ` on ${dateLong}` : ''}: the timeline, the vendor contact sheet and the day-of checklist are attached. This week I'm confirming every vendor's arrival time. On the day I'll be there from ${clock(b.arrive)} until the last vendor leaves. If anything changes, tell me as soon as you can and I'll update everyone.`),
        },
        {
          label: 'Day-before texts to each vendor',
          when: date ? time.shortDate(time.addDays(date, -1)) : 'The day before',
          text: vendors.map((v) => v.day_message).join('\n\n') || 'Add your vendors to get a text for each one.',
        },
      ];
      const rain = plain(input.rain_plan || '').replace(/[\s.;:,!]+$/, '');
      const checklist = Object.entries(T.day_of).map(([t, items]) => ({ title: t, items: t === 'During the event' && rain ? [...items, `Rain plan: ${rain}. Decide with the venue and the client before anything is set up outside.`] : items }));

      const palette = color.palette(color.isHex(String(input.color || '').trim()) ? String(input.color).trim() : 'calm', 0);
      const page = pageHtml(T, {
        title,
        business: me.business,
        first: me.first,
        phone: me.phone,
        coord: b.coord,
        dateLong,
        venueName,
        guests: Number.isInteger(input.guests) ? input.guests : parseInt(input.guests, 10) || 0,
        wedding: b.wedding,
        S: b.S,
        E: b.E,
        arriveText: clock(b.arrive),
        warnings,
        rows,
        vendors,
        checklist,
        rain: rain ? `${rain}.` : '',
        palette,
      });
      const file = await save.saveFile(ctx, save.fileName(title, 'day-of timeline', '.html'), page);
      const csv = await save.saveFile(
        ctx,
        save.fileName(title, 'vendor contact sheet', '.csv'),
        files.csv(
          vendors.map((v) => ({ ...v, confirmed: v.confirm ? 'Confirm' : 'Typed in' })),
          [
            { key: 'role', label: 'Role' },
            { key: 'name', label: 'Business' },
            { key: 'contact', label: 'Contact' },
            { key: 'phone', label: 'Phone' },
            { key: 'email', label: 'Email' },
            { key: 'arrives', label: 'Arrives' },
            { key: 'confirmed', label: 'Arrival time' },
            { key: 'notes', label: 'Notes' },
            { key: 'week_message', label: 'Week-before message' },
            { key: 'day_message', label: 'Day-before text' },
          ],
        ),
      );

      // Countdown reminders from the event date, skipping any already past.
      let countdown = [];
      let ics; // only when there are reminders still ahead
      if (date && date >= today) {
        const fillC = (s) => C.fill(s, { client: greet || 'your client', arrive: clock(b.arrive) });
        const all = T.countdown.map((c) => ({ date: time.addDays(date, c.days), days: c.days, title: `${c.title}: ${title}`, description: fillC(c.description) }));
        countdown = all.filter((c) => c.date >= today);
        const skipped = all.length - countdown.length;
        if (skipped) notes.push(`Skipped ${skipped} countdown ${skipped === 1 ? 'reminder' : 'reminders'} already past.`);
        const slug = text.slug(title, 30) || 'event';
        const events = countdown.map((c) => ({
          uid: `${slug}-${date}-${c.days + 100}@127group.io`,
          title: c.title,
          description: c.description,
          date: c.date,
          ...(c.days === 0 && b.arrive >= 0 && b.arrive < DAY_MIN ? { time: hhmm(b.arrive), minutes: Math.min(b.span, DAY_MIN - b.arrive) } : {}),
          tz: time.tzOf(ctx),
        }));
        if (events.length) ics = await save.saveFile(ctx, save.fileName(title, 'countdown', '.ics'), files.ics(events, { name: `${title} countdown`, now: time.nowMs(ctx) }));
      } else if (!date) notes.push('Add the event date to get the countdown reminders for your calendar.');

      // The timeline goes on the client's Pipeline row when they're already there (after Log the booking).
      let saved = { saved: false };
      const lead = clientName ? await C.findLead(ctx, N.id, clientName) : null;
      if (lead) {
        saved = await C.saveLead(ctx, N.id, lead, {
          note: clip(`Day-of timeline made ${time.shortDate(today)}${date ? ` for ${time.shortDate(date)}` : ''}: arrive ${clock(b.arrive)}, ${b.wedding ? 'ceremony' : 'start'} ${clock(b.S)}, ${vendors.length} ${vendors.length === 1 ? 'vendor' : 'vendors'}.`, 1000),
          data: { timeline: { date: date || null, start: clock(b.S), end: clock(b.E), arrive: clock(b.arrive), vendors: vendors.length, on: today } },
        }, { name: clientName });
      } else if (clientName) notes.push(`${clientName} isn't in your Pipeline yet: log the booking first to keep the timeline on their row.`);

      const event = {
        type: b.type,
        name: title,
        ...(date ? { date } : {}),
        ...(venueName ? { venue: venueName } : {}),
        start: clock(b.S),
        end: clock(b.E),
        ...(b.wedding ? { ceremony: b.ceremony, first_look: b.first } : {}),
        ...(Number.isInteger(input.guests) ? { guests: input.guests } : {}),
      };
      return {
        title,
        ...(clientName ? { client: clientName } : {}),
        event,
        rows,
        vendors,
        checklist,
        messages,
        countdown,
        span: { arrive: clock(b.arrive), leave: clock(b.leave), minutes: b.span, hours: hoursText(b.span), booked: b.booked },
        warnings,
        notes,
        file,
        csv,
        ...(ics ? { ics } : {}),
        saved,
        sources: T.sources.map((s) => ({ publisher: s.publisher, url: s.url, says: s.says })),
      };
    },
    view(out) {
      const s = out.saved || {};
      return views.blocks(
        views.metric('Day-of timeline', `${out.span.arrive} to ${out.span.leave}`, `${out.title}: ${out.rows.length} rows, ${out.vendors.length} ${out.vendors.length === 1 ? 'vendor' : 'vendors'}. You're on site ${out.span.hours} (booked for ${out.span.booked}).`),
        out.warnings.length ? views.text(`Check before you send: ${out.warnings.join(' ')}`) : null,
        views.table(
          [
            { key: 'time', label: 'Time' },
            { key: 'what', label: 'What' },
            { key: 'who', label: 'Who' },
            { key: 'note', label: 'Notes' },
          ],
          out.rows,
        ),
        views.file(out.file, 'Timeline, vendor contact sheet and day-of checklist (print or send)'),
        views.copy(`${out.messages[0].label} (${out.messages[0].when})`, out.messages[0].text),
        out.vendors.map((v) => views.copy(`To ${v.name} (${v.role.replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase())}), a week before`, v.week_message)),
        views.copy(`${out.messages[1].label} (${out.messages[1].when})`, out.messages[1].text),
        views.file(out.csv, 'Vendor contact sheet (CSV)'),
        out.ics ? views.file(out.ics, 'Countdown reminders for your calendar') : null,
        out.notes.length ? views.text(out.notes.join(' ')) : null,
        s.saved && out.client ? views.text(`Saved on ${out.client}'s row in your Pipeline.`) : null,
        (out.sources || []).map((x) => views.link(`${x.publisher}: ${x.says}`, x.url)),
      );
    },
  };
}

module.exports = { timelineTool, parseClock, parseVendor, rolesOf, clock, build, TYPES };
