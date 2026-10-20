// Reading the CSV files members export from their own accounts: text decoding, rows, header words,
// numbers and dates. No kit dependencies, so the same code can be read and checked on its own.
// The pattern follows content/lib/rank.js (parseTable, num, parseDate), copied, not required:
// packs never require another pack's files.

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = (n) => String(n).padStart(2, '0');

// A Library file to text: UTF-8 or UTF-16 (Google Ads' "Excel CSV" is UTF-16 with tabs), never a
// spreadsheet or a ZIP.
function decode(buf) {
  if (buf[0] === 0x50 && buf[1] === 0x4b) throw new Error('That looks like an Excel or ZIP file. Open it, save it as CSV, and add the CSV instead.');
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.slice(2).toString('utf16le');
  if (buf[0] === 0xfe && buf[1] === 0xff) {
    const sw = Buffer.from(buf.slice(2));
    sw.swap16();
    return sw.toString('utf16le');
  }
  return buf.toString('utf8');
}

// Comma, tab or semicolon, from the busiest of the first lines (Google Ads puts a title line first).
function delimiterOf(s) {
  const lines = String(s || '').split(/\r?\n/).filter((l) => l.trim()).slice(0, 6);
  let best = ',';
  let most = 0;
  for (const d of ['\t', ';', ',']) {
    const n = Math.max(0, ...lines.map((l) => l.split(d).length - 1));
    if (n > most) {
      most = n;
      best = d;
    }
  }
  return best;
}

function parseTable(s) {
  const d = delimiterOf(s);
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  const t = String(s || '').replace(/^\ufeff/, '');
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"' && t[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"' && !cell.trim()) q = true;
    else if (ch === d) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows.map((r) => r.map((c) => c.trim()));
}

// "Amount spent (USD)" -> "amount spent", "Cost / conv." -> "cost conv", "Impr." -> "impr".
const normHead = (h) =>
  String(h || '')
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/[_\-:/]+/g, ' ')
    .replace(/[^a-z0-9# ]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// "$1,234.50" "-$1.09" "(12.00)" "1.2K" "12%" "1 234" "12,5" (decimal comma). Blank or "-" is null.
function num(v) {
  let s = String(v == null ? '' : v).trim().replace(/[\s\u00a0\u202f']/g, '');
  if (!s || /^[-\u2013\u2014]+$/.test(s) || /^(n\/?a|none|null|--)$/i.test(s)) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/^([+-]?)(?:US)?\$|^([+-]?)[A-Z]{3}/, '$1$2').replace(/(USD|EUR|GBP|CAD|AUD)$/i, '');
  if (s.startsWith('-')) {
    neg = !neg;
    s = s.slice(1);
  } else if (s.startsWith('+')) s = s.slice(1);
  s = s.replace(/^\$/, '');
  const m = s.match(/^([\d.,]+)([kmb])?%?$/i);
  if (!m) return null;
  let n = m[1];
  const mult = { k: 1e3, m: 1e6, b: 1e9 }[(m[2] || '').toLowerCase()] || 1;
  if (mult > 1) n = n.replace(',', '.');
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(n)) n = n.replace(/,/g, '');
  else if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(n)) n = n.replace(/\./g, '').replace(',', '.');
  else if (/^\d+,\d{1,2}$/.test(n)) n = n.replace(',', '.');
  else n = n.replace(/,/g, '');
  const x = parseFloat(n);
  if (!Number.isFinite(x)) return null;
  return Math.round((neg ? -x : x) * mult * 100) / 100;
}

function hour24(h, ap) {
  let x = Number(h);
  const a = String(ap || '').toLowerCase().replace(/\./g, '');
  if (a === 'pm' && x < 12) x += 12;
  if (a === 'am' && x === 12) x = 0;
  return x;
}

function validDate(y, mo, d) {
  if (!(y >= 2000 && y <= 2100 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return null;
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCMonth() !== mo - 1) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

// One date cell -> { date: 'YYYY-MM-DD', hour, minute } or null. order: 'mdy' or 'dmy' for 09/01/2026.
function parseDate(v, order = 'mdy') {
  const s = String(v || '').trim().replace(/^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s+/i, '');
  if (!s) return null;
  let y;
  let mo;
  let d;
  let h = null;
  let mi = null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) [y, mo, d, h, mi] = [m[1], m[2], m[3], m[4], m[5]];
  if (!m) {
    m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (m) [y, mo, d, h, mi] = [m[1], m[2], m[3], m[4], m[5]];
  }
  if (!m) {
    m = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})(?:,?\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]\.?m\.?)?)?/i);
    if (m) {
      [mo, d] = order === 'dmy' ? [m[2], m[1]] : [m[1], m[2]];
      y = m[3].length === 2 ? `20${m[3]}` : m[3];
      if (m[4] != null) {
        h = hour24(m[4], m[6]);
        mi = m[5];
      }
    }
  }
  if (!m) {
    m = s.match(/^([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})(?:,?\s+(?:at\s+)?(\d{1,2}):(\d{2})\s*([ap]\.?m\.?)?)?/i);
    if (m && MONTHS.includes(m[1].slice(0, 3).toLowerCase())) {
      [mo, d, y] = [MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1, m[2], m[3]];
      if (m[4] != null) {
        h = hour24(m[4], m[6]);
        mi = m[5];
      }
    } else m = null;
  }
  if (!m) {
    m = s.match(/^(\d{1,2})\s+([a-z]{3,9})\.?,?\s+(\d{4})(?:,?\s+(\d{1,2}):(\d{2})\s*([ap]\.?m\.?)?)?/i);
    if (m && MONTHS.includes(m[2].slice(0, 3).toLowerCase())) {
      [d, mo, y] = [m[1], MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1, m[3]];
      if (m[4] != null) {
        h = hour24(m[4], m[6]);
        mi = m[5];
      }
    } else m = null;
  }
  if (!m) return null;
  const date = validDate(Number(y), Number(mo), Number(d));
  if (!date) return null;
  const hour = h != null && Number(h) <= 23 ? Number(h) : null;
  return { date, hour, minute: hour != null ? Number(mi) || 0 : null };
}

// 'dmy' when any 13/09/2026-style cell can only be day first.
function dateOrder(cells) {
  for (const c of cells) {
    const m = String(c || '').trim().match(/^(\d{1,2})[/.](\d{1,2})[/.]\d{2,4}/);
    if (m && Number(m[1]) > 12) return 'dmy';
  }
  return 'mdy';
}

// A UTC date and time moved into the member's time zone (Stripe's "(UTC)" columns).
function fromUtc(p, tz) {
  if (!p || p.hour == null || !tz) return p;
  const [y, mo, d] = p.date.split('-').map(Number);
  const ms = Date.UTC(y, mo - 1, d, p.hour, p.minute || 0);
  try {
    const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const x = Object.fromEntries(f.formatToParts(new Date(ms)).map((q) => [q.type, q.value]));
    return { date: `${x.year}-${x.month}-${x.day}`, hour: Number(x.hour) % 24, minute: Number(x.minute) };
  } catch {
    return p;
  }
}

function addDays(dateStr, n) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + n * 86400000);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

function daysBetween(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

module.exports = { decode, delimiterOf, parseTable, normHead, num, parseDate, dateOrder, fromUtc, addDays, daysBetween, MONTHS };
