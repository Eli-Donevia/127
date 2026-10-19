// File builders with no dependencies: CSV, ZIP, ICS calendars, SRT and VTT captions, HTML escaping.
// Members get real files they can open, import or upload: a CSV opens in Sheets or Excel and imports
// into Shopify, a ZIP drags into Netlify Drop, an ICS adds to any calendar.

const zlib = require('zlib');

// ---------- CSV (RFC 4180) ----------

function csvCell(v) {
  if (v == null) return '';
  const s = Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// columns: ['key', ...] or [{ key, label }]. bom: true helps Excel read UTF-8.
function csv(rows, columns, { bom = false } = {}) {
  const cols = (columns || Object.keys((rows && rows[0]) || {})).map((c) => (typeof c === 'string' ? { key: c, label: c } : c));
  const lines = [cols.map((c) => csvCell(c.label != null ? c.label : c.key)).join(',')];
  for (const r of rows || []) lines.push(cols.map((c) => csvCell(r[c.key])).join(','));
  return `${bom ? '\ufeff' : ''}${lines.join('\r\n')}\r\n`;
}

// ---------- ZIP ----------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosTime(date) {
  const d = new Date(date);
  const time = (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | Math.floor(d.getUTCSeconds() / 2);
  const day = ((Math.max(1980, d.getUTCFullYear()) - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate();
  return { time, day };
}

// entries: [{ name: 'site/index.html', data: string|Buffer }]. Returns a Buffer.
// mtime: a fixed time keeps the bytes identical between runs (pass ctx.now()).
function zip(entries, { mtime = Date.UTC(2026, 0, 1) } = {}) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  const { time, day } = dosTime(mtime);
  for (const e of entries) {
    const name = Buffer.from(String(e.name).replace(/^\/+/, ''), 'utf8');
    const raw = Buffer.isBuffer(e.data) ? e.data : Buffer.from(String(e.data == null ? '' : e.data), 'utf8');
    const crc = crc32(raw);
    const deflated = zlib.deflateRawSync(raw, { level: 9 });
    const store = deflated.length >= raw.length;
    const body = store ? raw : deflated;
    const method = store ? 0 : 8;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, body);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(day, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + body.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, cd, end]);
}

// Reads back a zip made by zip() (tests use it to check contents). Returns [{ name, data }].
function unzip(buf) {
  const out = [];
  let p = 0;
  while (p + 30 <= buf.length && buf.readUInt32LE(p) === 0x04034b50) {
    const method = buf.readUInt16LE(p + 8);
    const csize = buf.readUInt32LE(p + 18);
    const nlen = buf.readUInt16LE(p + 26);
    const xlen = buf.readUInt16LE(p + 28);
    const name = buf.slice(p + 30, p + 30 + nlen).toString('utf8');
    const start = p + 30 + nlen + xlen;
    const body = buf.slice(start, start + csize);
    out.push({ name, data: method === 8 ? zlib.inflateRawSync(body) : body });
    p = start + csize;
  }
  return out;
}

// ---------- ICS ----------

function icsText(s) {
  return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function fold(line) {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const parts = [];
  let cur = '';
  for (const ch of line) {
    if (Buffer.byteLength(cur + ch, 'utf8') > (parts.length ? 74 : 75)) {
      parts.push(cur);
      cur = ch;
    } else cur += ch;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}

function icsStamp(ms) {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// events: [{ uid, title, description, url, date: 'YYYY-MM-DD', time: '09:00', minutes: 30, tz }]
// No time = all-day event. Times are converted to UTC so every calendar app agrees.
function ics(events, { name = '127 plan', now = Date.now() } = {}) {
  const { zonedToUtc } = require('./time-zone');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//127//Workflows//EN', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${icsText(name)}`];
  events.forEach((e, i) => {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${e.uid || `${i}-${String(e.date)}@127group.io`}`);
    lines.push(`DTSTAMP:${icsStamp(now)}`);
    if (e.time) {
      const start = zonedToUtc(e.date, e.time, e.tz || 'America/Chicago');
      lines.push(`DTSTART:${icsStamp(start)}`);
      lines.push(`DTEND:${icsStamp(start + (e.minutes || 30) * 60000)}`);
    } else {
      const d = String(e.date).replace(/-/g, '');
      lines.push(`DTSTART;VALUE=DATE:${d}`);
    }
    lines.push(`SUMMARY:${icsText(e.title)}`);
    if (e.description) lines.push(`DESCRIPTION:${icsText(e.description)}`);
    if (e.url) lines.push(`URL:${icsText(e.url)}`);
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

// ---------- captions ----------

function stamp(sec, sep) {
  const ms = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}${sep}${String(r).padStart(3, '0')}`;
}

// cues: [{ start: seconds, end: seconds, text }]
function srt(cues) {
  return `${cues.map((c, i) => `${i + 1}\n${stamp(c.start, ',')} --> ${stamp(c.end, ',')}\n${String(c.text).trim()}\n`).join('\n')}`;
}

function vtt(cues) {
  return `WEBVTT\n\n${cues.map((c) => `${stamp(c.start, '.')} --> ${stamp(c.end, '.')}\n${String(c.text).trim()}\n`).join('\n')}`;
}

// ---------- HTML ----------

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// A complete, standalone HTML document (inline CSS, no external requests unless `head` adds them).
function htmlDoc({ title = '', css = '', body = '', head = '', lang = 'en', description = '' } = {}) {
  return `<!doctype html>
<html lang="${esc(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
${description ? `<meta name="description" content="${esc(description)}">\n` : ''}${head}
<style>${css}</style>
</head>
<body>
${body}
</body>
</html>
`;
}

module.exports = { csv, csvCell, zip, unzip, crc32, ics, srt, vtt, esc, htmlDoc };
