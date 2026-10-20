// Plain text out of the files a member adds to their Brain: Markdown, text, CSV, HTML, Word (.docx)
// and PDF. PDF is best effort (text PDFs from Word, Google Docs or a browser read fine; scans and
// some embedded fonts don't), and says so instead of storing garbage.

const zlib = require('zlib');
const { readZip } = require('./zipfile');

const TYPES = {
  md: 'markdown',
  markdown: 'markdown',
  txt: 'text',
  text: 'text',
  csv: 'csv',
  tsv: 'csv',
  html: 'html',
  htm: 'html',
  docx: 'docx',
  pdf: 'pdf',
};

function kindOf(fileName) {
  const ext = String(fileName || '').toLowerCase().split('.').pop();
  return TYPES[ext] || null;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
    }
    return ENTITIES[e.toLowerCase()] !== undefined ? ENTITIES[e.toLowerCase()] : m;
  });
}

function tidy(s) {
  return String(s)
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function fromHtml(html) {
  return tidy(
    decodeEntities(
      String(html)
        .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, '')
        .replace(/<h([1-6])[^>]*>/gi, (m, n) => `\n\n${'#'.repeat(Number(n))} `)
        .replace(/<li[^>]*>/gi, '\n- ')
        .replace(/<(br|\/p|\/div|\/h[1-6]|\/li|\/tr)[^>]*>/gi, '\n')
        .replace(/<\/t[dh]>/gi, '\t')
        .replace(/<[^>]+>/g, '')
    )
  );
}

function fromDocx(buf) {
  const files = readZip(buf, { only: (n) => n === 'word/document.xml', maxBytes: 30 * 1024 * 1024 });
  if (!files.length) throw new Error("That Word file has no text we can read. Save it as .docx and try again.");
  const xml = files[0].data.toString('utf8');
  const paras = [];
  for (const p of xml.split(/<\/w:p>/)) {
    const style = (p.match(/<w:pStyle w:val="([^"]+)"/) || [])[1] || '';
    const heading = (style.match(/^(?:Heading|heading)(\d)$/) || [])[1];
    let text = '';
    for (const t of p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>/g)) text += t[0] === '<w:tab/>' ? '\t' : t[0] === '<w:br/>' ? '\n' : t[1];
    text = decodeEntities(text);
    const list = /<w:numPr>/.test(p);
    if (!text.trim()) {
      paras.push('');
      continue;
    }
    paras.push(heading ? `${'#'.repeat(Math.min(6, Number(heading)))} ${text.trim()}` : list ? `- ${text.trim()}` : text);
  }
  return tidy(paras.join('\n\n'));
}

// PDF: inflate the streams, then read the text-showing operators.
function pdfString(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c !== '\\') {
      out += c;
      continue;
    }
    const n = s[++i];
    if (n === 'n') out += '\n';
    else if (n === 'r') out += '';
    else if (n === 't') out += '\t';
    else if (n === 'b' || n === 'f') out += '';
    else if (/[0-7]/.test(n)) {
      let oct = n;
      while (oct.length < 3 && /[0-7]/.test(s[i + 1])) oct += s[++i];
      out += String.fromCharCode(parseInt(oct, 8));
    } else if (n === '\n' || n === '\r') {
      if (n === '\r' && s[i + 1] === '\n') i++;
    } else out += n;
  }
  return out;
}

function textOps(content) {
  const out = [];
  const re = /\((?:\\[\s\S]|[^\\)])*\)\s*(?:Tj|'|")|\[(?:[^\]\\]|\\[\s\S])*\]\s*TJ|\bT\*|-?[\d.]+\s+(-?[\d.]+)\s+T[dD]|\bET\b/g;
  let m;
  while ((m = re.exec(content))) {
    const t = m[0];
    if (t === 'T*' || t === 'ET') out.push('\n');
    else if (/T[dD]$/.test(t)) {
      if (Number(m[1]) !== 0) out.push('\n');
    } else if (t[0] === '(') {
      out.push(pdfString(t.slice(1, t.lastIndexOf(')'))));
      if (/['"]$/.test(t)) out.push('\n');
    } else {
      const inner = t.slice(1, t.lastIndexOf(']'));
      const parts = inner.match(/\((?:\\[\s\S]|[^\\)])*\)|-?[\d.]+/g) || [];
      for (const p of parts) {
        if (p[0] === '(') out.push(pdfString(p.slice(1, -1)));
        else if (Number(p) < -200) out.push(' ');
      }
    }
  }
  return out.join('');
}

function fromPdf(buf) {
  const raw = buf.toString('latin1');
  if (!raw.startsWith('%PDF')) throw new Error("That file doesn't look like a PDF.");
  if (/\/Encrypt\b/.test(raw)) throw new Error('That PDF is locked. Save an unlocked copy, or paste the text instead.');
  const chunks = [];
  const re = /<<((?:(?!>>\s*stream)[\s\S]){0,2000})>>\s*stream\r?\n/g;
  let m;
  while ((m = re.exec(raw))) {
    const dict = m[1];
    const start = m.index + m[0].length;
    const end = raw.indexOf('endstream', start);
    if (end < 0) break;
    re.lastIndex = end;
    if (/\/Subtype\s*\/(Image|Form)|\/Type\s*\/(XObject|XRef|ObjStm|Metadata)|\/Length1|\/FontFile/.test(dict)) continue;
    let data = buf.slice(start, end);
    if (/\/FlateDecode/.test(dict)) {
      try {
        data = zlib.inflateSync(data, { maxOutputLength: 20 * 1024 * 1024 });
      } catch {
        try {
          data = zlib.inflateSync(data.slice(0, data.length - 2), { maxOutputLength: 20 * 1024 * 1024 });
        } catch {
          continue;
        }
      }
    } else if (/\/Filter/.test(dict)) continue;
    const s = data.toString('latin1');
    if (/\bBT\b/.test(s)) chunks.push(textOps(s));
  }
  const text = tidy(chunks.join('\n\n').replace(/[ \t]{2,}/g, ' '));
  const letters = (text.match(/[A-Za-z]/g) || []).length;
  if (text.length < 20 || letters / text.length < 0.5) {
    throw new Error("Couldn't read the text in that PDF (it may be a scan). Copy the text and paste it instead.");
  }
  return text;
}

// buf: the file's bytes. Returns { text, kind }.
function extract(fileName, buf) {
  const kind = kindOf(fileName);
  if (!kind) throw new Error('Add a Markdown, text, CSV, HTML, Word (.docx) or PDF file.');
  let text;
  if (kind === 'docx') text = fromDocx(buf);
  else if (kind === 'pdf') text = fromPdf(buf);
  else {
    let s = buf.toString('utf8').replace(/^﻿/, '');
    if (kind === 'html') s = fromHtml(s);
    text = tidy(s);
  }
  if (!text) throw new Error('That file has no text in it.');
  return { text, kind };
}

module.exports = { extract, kindOf, fromHtml, fromDocx, fromPdf, decodeEntities, tidy, TYPES };
