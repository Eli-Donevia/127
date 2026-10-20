// Text from a file a member uploads: .txt, .md, .html, .eml, .ics, .csv as text, and Word .docx
// (a ZIP with word/document.xml). Reads ZIPs from the central directory, so files written with
// data descriptors (sizes after the data, as some apps do) read too. No packages.

const fs = require('fs');
const zlib = require('zlib');

const MAX = 4 * 1024 * 1024;

// [{ name, data }] for every file in a ZIP buffer.
function readZip(buf, { maxFiles = 400, maxBytes = 20 * 1024 * 1024 } = {}) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("This file isn't a ZIP we can open.");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = [];
  let total = 0;
  for (let n = 0; n < Math.min(count, maxFiles) && p + 46 <= buf.length && buf.readUInt32LE(p) === 0x02014b50; n++) {
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const usize = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28);
    const xlen = buf.readUInt16LE(p + 30);
    const clen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nlen).toString('utf8');
    p += 46 + nlen + xlen + clen;
    if (name.endsWith('/') || local + 30 > buf.length) continue;
    total += usize;
    if (total > maxBytes) throw new Error('This ZIP is too big to read here.');
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const body = buf.slice(start, start + csize);
    let data;
    if (method === 0) data = body;
    else if (method === 8) data = zlib.inflateRawSync(body);
    else continue;
    out.push({ name, data });
  }
  return out;
}

function docxText(buf) {
  const doc = readZip(buf).find((f) => f.name === 'word/document.xml');
  if (!doc) throw new Error("This Word file has no text we can read. Save it as .docx or .txt and try again.");
  return doc.data
    .toString('utf8')
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:br[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const htmlText = (s) =>
  String(s)
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();

// Reads an uploaded asset (from ctx.asset) as { name, text, kind }.
async function assetText(ctx, id, { what = 'file' } = {}) {
  if (!ctx || typeof ctx.asset !== 'function') throw new Error(`Couldn't open the ${what}. Try adding it again.`);
  const a = await ctx.asset(id);
  if (!a || !a.path) throw new Error(`Couldn't open the ${what}. Try adding it again.`);
  const buf = fs.readFileSync(a.path);
  if (buf.length > MAX) throw new Error(`That ${what} is over 4 MB. Try a smaller export.`);
  const name = String(a.name || '').toLowerCase();
  const isZip = buf.length > 4 && buf.readUInt32LE(0) === 0x04034b50;
  if (/\.pdf$/.test(name) || buf.slice(0, 5).toString() === '%PDF-') throw new Error(`This is a PDF. Open it, copy the text and paste it in, or save it as a Word or text file.`);
  if (/\.xlsx?$/.test(name)) throw new Error('This is an Excel file. In Excel or Google Sheets, save it as CSV and add that instead.');
  if (isZip && /\.docx$/.test(name)) return { name: a.name, text: docxText(buf), kind: 'docx' };
  if (isZip) return { name: a.name, kind: 'zip', files: readZip(buf).filter((f) => !/(^|\/)(__MACOSX|\.)/.test(f.name)) };
  const text = buf.toString('utf8').replace(/^\ufeff/, '');
  if (/\.html?$/.test(name) || /^\s*<(!doctype|html)/i.test(text)) return { name: a.name, text: htmlText(text), kind: 'html' };
  return { name: a.name, text, kind: 'text' };
}

module.exports = { readZip, docxText, htmlText, assetText };
