// Reading email the member hands over: .eml files (one message, with headers, multipart bodies,
// quoted-printable or base64), .mbox exports (many messages), a ZIP of .eml files, or a thread
// pasted as text. Returns messages as { from, fromName, to, subject, date, body, unsubscribe }.
// Nothing here connects to a mailbox.

const MAX_BODY = 6000;

function decodeQP(s) {
  const bytes = [];
  const t = String(s).replace(/=\r?\n/g, '');
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '=' && /^[0-9A-F]{2}$/i.test(t.slice(i + 1, i + 3))) {
      bytes.push(parseInt(t.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      const b = Buffer.from(t[i], 'utf8');
      for (const x of b) bytes.push(x);
    }
  }
  return Buffer.from(bytes).toString('utf8');
}

function decodeB64(s, charset) {
  const buf = Buffer.from(String(s).replace(/\s+/g, ''), 'base64');
  return /8859|latin|1252/i.test(charset || '') ? buf.toString('latin1') : buf.toString('utf8');
}

// "=?UTF-8?B?...?=" and "=?utf-8?Q?...?=" words in headers.
function decodeWords(s) {
  return String(s || '')
    .replace(/\?=\s+=\?/g, '?==?')
    .replace(/=\?([^?]+)\?([BQ])\?([^?]*)\?=/gi, (all, cs, enc, txt) => {
      try {
        return /b/i.test(enc) ? decodeB64(txt, cs) : decodeQP(txt.replace(/_/g, ' '));
      } catch {
        return all;
      }
    });
}

function splitHead(raw) {
  const s = String(raw).replace(/\r\n/g, '\n');
  const i = s.search(/\n\n/);
  return i < 0 ? { head: s, body: '' } : { head: s.slice(0, i), body: s.slice(i + 2) };
}

function headers(head) {
  const out = {};
  for (const line of String(head).replace(/\n[ \t]+/g, ' ').split('\n')) {
    const m = line.match(/^([A-Za-z0-9-]+):\s*(.*)$/);
    if (m) {
      const k = m[1].toLowerCase();
      if (!(k in out)) out[k] = m[2].trim();
    }
  }
  return out;
}

function param(value, name) {
  const m = String(value || '').match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|[^;\\s]+)`, 'i'));
  return m ? (m[2] != null ? m[2] : m[1]) : '';
}

function htmlToText(h) {
  return String(h)
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h\d|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (a, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

// The readable text of a MIME part: text/plain first, else text/html turned into text.
function bodyOf(h, body, depth = 0) {
  const type = (h['content-type'] || 'text/plain').toLowerCase();
  const enc = (h['content-transfer-encoding'] || '').toLowerCase();
  if (type.startsWith('multipart/') && depth < 5) {
    const boundary = param(h['content-type'], 'boundary');
    if (!boundary) return '';
    const parts = body.split(new RegExp(`\\n?--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:--)?\\s*\\n`)).slice(1);
    const read = parts.map((p) => {
      const { head, body: b } = splitHead(p);
      const ph = headers(head);
      return { type: (ph['content-type'] || 'text/plain').toLowerCase(), attach: /attachment/i.test(ph['content-disposition'] || ''), text: bodyOf(ph, b, depth + 1) };
    }).filter((p) => !p.attach && p.text);
    const plainPart = read.find((p) => p.type.startsWith('text/plain'));
    return (plainPart || read.find((p) => p.type.startsWith('text/html')) || read.find((p) => p.text) || { text: '' }).text;
  }
  if (!type.startsWith('text/')) return '';
  const charset = param(h['content-type'], 'charset');
  let t = body;
  if (enc === 'base64') t = decodeB64(body, charset);
  else if (enc === 'quoted-printable') t = decodeQP(body);
  return type.startsWith('text/html') ? htmlToText(t) : t;
}

// "Maya Chen <maya@shop.example>" -> { name, email }
function address(v) {
  const s = decodeWords(v);
  const m = s.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>/);
  if (m) return { name: m[1].trim(), email: m[2].trim().toLowerCase() };
  const e = s.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/);
  return { name: '', email: e ? e[0].toLowerCase() : s.trim() };
}

// The newest message in a body: cut at "On ... wrote:", "-----Original Message-----", a "From:"
// block or quoted ">" lines.
function latestPart(body) {
  const lines = String(body || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*>/.test(l)) break;
    if (/^\s*-{2,}\s*(original message|forwarded message)/i.test(l)) break;
    if (/^\s*On .{4,120}wrote:\s*$/i.test(l) || (/^\s*On .{4,120}$/i.test(l) && /wrote:\s*$/i.test(lines[i + 1] || ''))) break;
    if (/^\s*From:\s.+/i.test(l) && /^\s*(Sent|Date|To|Subject):/i.test(lines[i + 1] || '')) break;
    out.push(l);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function fromEml(raw) {
  const { head, body } = splitHead(raw);
  const h = headers(head);
  const from = address(h.from || '');
  const text = bodyOf(h, body.replace(/\r\n/g, '\n'));
  return {
    from: from.email,
    fromName: from.name,
    to: address(h.to || '').email,
    subject: decodeWords(h.subject || '').trim() || '(no subject)',
    date: h.date || '',
    body: latestPart(text).slice(0, MAX_BODY) || text.trim().slice(0, MAX_BODY),
    unsubscribe: !!h['list-unsubscribe'] || /\bunsubscribe\b/i.test(text),
    bulk: /bulk|list|junk/i.test(h.precedence || '') || !!h['list-id'],
    autoReply: /auto-replied|auto-generated/i.test(h['auto-submitted'] || '') || /^(auto|out of office)/i.test(decodeWords(h.subject || '')),
  };
}

// An mbox file: messages start with a line "From something date".
function splitMbox(raw) {
  return String(raw).replace(/\r\n/g, '\n').split(/\n(?=From [^\n]*\d{4}\s*\n)/).map((m) => m.replace(/^From [^\n]*\n/, '')).filter((m) => /^[A-Za-z-]+:/m.test(m));
}

const looksLikeEml = (s) => /^(?:From [^\n]*\n)?(?:[A-Za-z-]+:[^\n]*\n(?:[ \t][^\n]*\n)*){2,}/.test(String(s).replace(/\r\n/g, '\n')) && /^(received|return-path|message-id|mime-version|content-type|delivered-to|dkim-signature|x-[a-z-]+):/im.test(s);

// A pasted inbox or thread. Messages are split on header blocks ("From: ..." then Subject/Date/To)
// or on a line of dashes or "====". Each piece without headers is one message from "Unknown".
function fromPasted(textIn) {
  const s = String(textIn || '').replace(/\r\n/g, '\n').trim();
  if (!s) return [];
  const pieces = s.split(/\n\s*(?:-{5,}|={5,}|_{5,})\s*\n|\n(?=From:\s.+\n(?:(?:Sent|Date|To|Subject|Cc):.*\n){1,4})/i).map((p) => p.trim()).filter(Boolean);
  return pieces.map((p) => {
    const lines = p.split('\n');
    const h = {};
    let i = 0;
    for (; i < Math.min(lines.length, 8); i++) {
      const m = lines[i].match(/^(From|To|Subject|Date|Sent|Cc):\s*(.*)$/i);
      if (!m) break;
      h[m[1].toLowerCase()] = m[2].trim();
    }
    const body = lines.slice(i).join('\n').trim();
    const from = address(h.from || '');
    return {
      from: from.email || '',
      fromName: from.name || (from.email ? '' : h.from || ''),
      to: h.to ? address(h.to).email : '',
      subject: h.subject || (body.split('\n')[0] || '').slice(0, 80) || '(no subject)',
      date: h.date || h.sent || '',
      body: (latestPart(body) || body).slice(0, MAX_BODY),
      unsubscribe: /\bunsubscribe\b/i.test(body),
      bulk: false,
      autoReply: /^(auto|automatic reply|out of office)/i.test(h.subject || ''),
    };
  }).filter((m) => m.body || m.subject !== '(no subject)');
}

// Any of the above from a file's text or bytes.
function readMessages(textIn) {
  const s = String(textIn || '');
  if (/^From [^\n]*\d{4}\s*\r?\n/.test(s)) return splitMbox(s).map(fromEml);
  if (looksLikeEml(s)) return [fromEml(s)];
  return fromPasted(s);
}

module.exports = { readMessages, fromEml, fromPasted, splitMbox, latestPart, decodeQP, decodeWords, address, htmlToText, looksLikeEml };
