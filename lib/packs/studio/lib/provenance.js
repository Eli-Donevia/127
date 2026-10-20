// Provenance tags (Legal row 8, V4): the IPTC Digital Source Type written into every image and video
// the studio makes or edits, as XMP, in plain JS (no npm, no exiftool):
//   MP4 / MOV  a top-level 'uuid' box with the XMP UUID BE7ACFCB-97A9-42E8-9C71-999491E3AFAC, added at
//              the end of the file so no chunk offset moves (faststart files keep moov before mdat)
//   PNG        an iTXt chunk with keyword "XML:com.adobe.xmp", just before IEND
//   JPEG       an APP1 XMP segment right after SOI (and APP0 / Exif APP1 when present)
//   WebP       an 'XMP ' chunk at the end, with the XMP flag set in VP8X (added when the file has none)
// Values (http://cv.iptc.org/newscodes/digitalsourcetype/):
//   'ai'        trainedAlgorithmicMedia               a file a model made
//   'mixed'     compositeWithTrainedAlgorithmicMedia  an edit or assembly with any AI-made part
//   'composite' composite                             an edit with no AI part (the member's own footage)
// A file that already carries a C2PA manifest (a JUMBF 'jumb' box or 'c2pa' label, PNG 'caBX', JPEG
// APP11 JUMBF, WebP 'C2PA') is never touched: it stays byte-identical (V4: never strip a credential).

const { save } = require('../../_kit');

const NS = 'http://cv.iptc.org/newscodes/digitalsourcetype/';
const CODES = { ai: 'trainedAlgorithmicMedia', mixed: 'compositeWithTrainedAlgorithmicMedia', composite: 'composite' };
const ALIASES = { ai: 'ai', model: 'ai', trainedalgorithmicmedia: 'ai', mixed: 'mixed', edit: 'mixed', 'composite-ai': 'mixed', compositewithtrainedalgorithmicmedia: 'mixed', composite: 'composite', own: 'composite', sample: 'composite' };
const XMP_UUID = Buffer.from('BE7ACFCB97A942E89C71999491E3AFAC', 'hex');
const C2PA_UUID = Buffer.from('D8FEC3D61B0E483C92975828877EC481', 'hex');
const JPEG_XMP_NS = Buffer.from('http://ns.adobe.com/xap/1.0/\0', 'latin1');
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_KEY = 'XML:com.adobe.xmp';

function sourceKey(source) {
  const k = ALIASES[String(source || '').toLowerCase().replace(/^.*\//, '')];
  if (!k) throw new Error(`Unknown provenance source "${source}"`);
  return k;
}

const urlFor = (source) => NS + CODES[sourceKey(source)];

function xmpPacket(url) {
  return Buffer.from(
    '<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>\n' +
      '<x:xmpmeta xmlns:x="adobe:ns:meta/">\n' +
      ' <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">\n' +
      `  <rdf:Description rdf:about="" xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/" Iptc4xmpExt:DigitalSourceType="${url}"/>\n` +
      ' </rdf:RDF>\n' +
      '</x:xmpmeta>\n' +
      '<?xpacket end="w"?>',
    'utf8',
  );
}

// 'png', 'jpeg', 'webp', 'mp4' (MP4 and MOV) or null, from the bytes (a type or file name only as a hint).
function kindOf(buf, hint) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf.subarray(0, 8).equals(PNG_SIG)) return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  const t = buf.toString('latin1', 4, 8);
  if (['ftyp', 'moov', 'mdat', 'free', 'wide', 'skip', 'pnot'].includes(t)) return 'mp4';
  if (hint && /mp4|quicktime|mov/i.test(hint)) return null;
  return null;
}

// ---------- ISO BMFF (MP4, MOV) ----------

function boxes(buf) {
  const out = [];
  let off = 0;
  while (off + 8 <= buf.length) {
    let size = buf.readUInt32BE(off);
    const type = buf.toString('latin1', off + 4, off + 8);
    let head = 8;
    if (size === 1) {
      if (off + 16 > buf.length) break;
      size = Number(buf.readBigUInt64BE(off + 8));
      head = 16;
    } else if (size === 0) size = buf.length - off;
    if (size < head || off + size > buf.length) break;
    out.push({ off, size, type, head });
    off += size;
  }
  return out;
}

function mp4C2pa(buf, list) {
  for (const b of list) {
    if (b.type === 'jumb') return true;
    if (b.type === 'uuid') {
      const id = buf.subarray(b.off + b.head, b.off + b.head + 16);
      if (id.equals(C2PA_UUID)) return true;
      const body = buf.subarray(b.off + b.head + 16, Math.min(b.off + b.size, b.off + b.head + 16 + 4096));
      if (body.includes('jumb') && body.includes('c2pa')) return true;
    }
  }
  return false;
}

function mp4Xmp(buf, list) {
  const b = list.find((x) => x.type === 'uuid' && buf.subarray(x.off + x.head, x.off + x.head + 16).equals(XMP_UUID));
  return b ? { box: b, xmp: buf.toString('utf8', b.off + b.head + 16, b.off + b.size) } : null;
}

function tagMp4(buf, url) {
  const list = boxes(buf);
  if (!list.length) return buf;
  const xmp = xmpPacket(url);
  const box = Buffer.alloc(8 + 16 + xmp.length);
  box.writeUInt32BE(box.length, 0);
  box.write('uuid', 4, 'latin1');
  XMP_UUID.copy(box, 8);
  xmp.copy(box, 24);
  let body = buf;
  const old = mp4Xmp(buf, list);
  if (old) {
    if (old.box.off + old.box.size === buf.length) body = buf.subarray(0, old.box.off);
    else {
      // An older tag in the middle: turn it into a 'free' box of the same size, so no offset moves.
      body = Buffer.from(buf);
      body.write('free', old.box.off + 4, 'latin1');
    }
  }
  return Buffer.concat([body, box]);
}

// ---------- PNG ----------

const CRC = (() => {
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
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunks(buf) {
  const out = [];
  let off = 8;
  while (off + 12 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('latin1', off + 4, off + 8);
    if (off + 12 + len > buf.length) break;
    out.push({ off, len, type, end: off + 12 + len });
    off += 12 + len;
    if (type === 'IEND') break;
  }
  return out;
}

const isPngXmp = (buf, c) => c.type === 'iTXt' && buf.toString('latin1', c.off + 8, c.off + 8 + PNG_KEY.length + 1) === `${PNG_KEY}\0`;

function pngXmp(buf, list) {
  const c = list.find((x) => isPngXmp(buf, x));
  if (!c) return null;
  const data = buf.subarray(c.off + 8, c.off + 8 + c.len);
  // keyword \0, compression flag, method, language \0, translated keyword \0, text
  let p = PNG_KEY.length + 3;
  p = data.indexOf(0, p) + 1;
  p = data.indexOf(0, p) + 1;
  return data.toString('utf8', p);
}

function tagPng(buf, url) {
  const list = chunks(buf);
  const iend = list.find((c) => c.type === 'IEND');
  if (!iend) return buf;
  const data = Buffer.concat([Buffer.from(`${PNG_KEY}\0\0\0\0\0`, 'latin1'), xmpPacket(url)]);
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  chunk.write('iTXt', 4, 'latin1');
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, 8 + data.length)), 8 + data.length);
  const parts = [buf.subarray(0, 8)];
  for (const c of list) {
    if (c.type === 'IEND') parts.push(chunk);
    if (!isPngXmp(buf, c)) parts.push(buf.subarray(c.off, c.end));
  }
  return Buffer.concat(parts);
}

// ---------- JPEG ----------

function segments(buf) {
  const out = [];
  let off = 2;
  while (off + 4 <= buf.length && buf[off] === 0xff) {
    const marker = buf[off + 1];
    if (marker === 0xd9 || marker === 0xda) {
      out.push({ off, marker, len: 0, end: off });
      break;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      off += 2;
      continue;
    }
    const len = buf.readUInt16BE(off + 2);
    out.push({ off, marker, len, end: off + 2 + len });
    off += 2 + len;
  }
  return out;
}

const isJpegXmp = (buf, s) => s.marker === 0xe1 && buf.subarray(s.off + 4, s.off + 4 + JPEG_XMP_NS.length).equals(JPEG_XMP_NS);

function jpegC2pa(buf, list) {
  return list.some((s) => s.marker === 0xeb && (buf.subarray(s.off + 4, s.end).includes('jumb') || buf.subarray(s.off + 4, s.end).includes('c2pa')));
}

function tagJpeg(buf, url) {
  const list = segments(buf);
  const xmp = Buffer.concat([JPEG_XMP_NS, xmpPacket(url)]);
  if (xmp.length + 2 > 0xffff) return buf;
  const seg = Buffer.alloc(4 + xmp.length);
  seg.writeUInt16BE(0xffe1, 0);
  seg.writeUInt16BE(xmp.length + 2, 2);
  xmp.copy(seg, 4);
  // After SOI, then after a leading APP0 (JFIF) and an Exif APP1, which readers expect first.
  let at = 2;
  for (const s of list) {
    if (s.marker === 0xe0 || (s.marker === 0xe1 && buf.toString('latin1', s.off + 4, s.off + 8) === 'Exif')) at = s.end;
    else break;
  }
  const parts = [buf.subarray(0, at), seg];
  let pos = at;
  for (const s of list) {
    if (s.off < at || !isJpegXmp(buf, s)) continue;
    parts.push(buf.subarray(pos, s.off));
    pos = s.end;
  }
  parts.push(buf.subarray(pos));
  return Buffer.concat(parts);
}

// ---------- WebP ----------

function riff(buf) {
  const out = [];
  let off = 12;
  while (off + 8 <= buf.length) {
    const type = buf.toString('latin1', off, off + 4);
    const len = buf.readUInt32LE(off + 4);
    if (off + 8 + len > buf.length) break;
    out.push({ off, type, len, end: Math.min(buf.length, off + 8 + len + (len & 1)) });
    off += 8 + len + (len & 1);
  }
  return out;
}

function riffChunk(type, data) {
  const pad = data.length & 1;
  const c = Buffer.alloc(8 + data.length + pad);
  c.write(type, 0, 'latin1');
  c.writeUInt32LE(data.length, 4);
  data.copy(c, 8);
  return c;
}

// A VP8X header for a simple (VP8 or VP8L) file, from the picture's own size.
function vp8x(buf, first) {
  const d = buf.subarray(first.off + 8, first.off + 8 + first.len);
  let w;
  let h;
  let alpha = false;
  if (first.type === 'VP8 ' && d[3] === 0x9d && d[4] === 0x01 && d[5] === 0x2a) {
    w = d.readUInt16LE(6) & 0x3fff;
    h = d.readUInt16LE(8) & 0x3fff;
  } else if (first.type === 'VP8L' && d[0] === 0x2f) {
    const bits = d.readUInt32LE(1);
    w = (bits & 0x3fff) + 1;
    h = ((bits >>> 14) & 0x3fff) + 1;
    alpha = !!((bits >>> 28) & 1);
  } else return null;
  const x = Buffer.alloc(10);
  x[0] = (alpha ? 0x10 : 0) | 0x04;
  x.writeUIntLE(w - 1, 4, 3);
  x.writeUIntLE(h - 1, 7, 3);
  return riffChunk('VP8X', x);
}

function tagWebp(buf, url) {
  const list = riff(buf);
  if (!list.length) return buf;
  const parts = [];
  if (list[0].type !== 'VP8X') {
    const head = vp8x(buf, list[0]);
    if (!head) return buf;
    parts.push(head);
  }
  for (const c of list) {
    if (c.type === 'XMP ') continue;
    const piece = Buffer.from(buf.subarray(c.off, c.end));
    if (c.type === 'VP8X') piece[8] |= 0x04;
    parts.push(piece);
  }
  parts.push(riffChunk('XMP ', xmpPacket(url)));
  const body = Buffer.concat(parts);
  const top = Buffer.alloc(12);
  top.write('RIFF', 0, 'latin1');
  top.writeUInt32LE(body.length + 4, 4);
  top.write('WEBP', 8, 'latin1');
  return Buffer.concat([top, body]);
}

// ---------- public ----------

// Does the file carry a C2PA manifest?
function hasC2pa(buf, kind = kindOf(buf)) {
  if (kind === 'png') return chunks(buf).some((c) => c.type === 'caBX');
  if (kind === 'jpeg') return jpegC2pa(buf, segments(buf));
  if (kind === 'mp4') return mp4C2pa(buf, boxes(buf));
  if (kind === 'webp') return riff(buf).some((c) => c.type === 'C2PA');
  return false;
}

// The file with the Digital Source Type written in. source: 'ai', 'mixed' or 'composite'. A file
// with a C2PA manifest, or a kind we don't tag, comes back as it was (the same Buffer).
function tag(buffer, { type, source = 'mixed' } = {}) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const kind = kindOf(buf, type);
  if (!kind || hasC2pa(buf, kind)) return buffer;
  const url = urlFor(source);
  try {
    if (kind === 'png') return tagPng(buf, url);
    if (kind === 'jpeg') return tagJpeg(buf, url);
    if (kind === 'webp') return tagWebp(buf, url);
    return tagMp4(buf, url);
  } catch {
    return buffer;
  }
}

// What a file says about itself: { kind, c2pa, xmp, source (the full URL or null), key ('ai',
// 'mixed', 'composite' or null) }.
function read(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const kind = kindOf(buf);
  let xmp = null;
  try {
    if (kind === 'png') xmp = pngXmp(buf, chunks(buf));
    else if (kind === 'jpeg') {
      const s = segments(buf).find((x) => isJpegXmp(buf, x));
      xmp = s ? buf.toString('utf8', s.off + 4 + JPEG_XMP_NS.length, s.end) : null;
    } else if (kind === 'webp') {
      const c = riff(buf).find((x) => x.type === 'XMP ');
      xmp = c ? buf.toString('utf8', c.off + 8, c.off + 8 + c.len) : null;
    } else if (kind === 'mp4') {
      const m = mp4Xmp(buf, boxes(buf));
      xmp = m ? m.xmp : null;
    }
  } catch {
    xmp = null;
  }
  const m = xmp && xmp.match(/DigitalSourceType(?:="|>)([^"<]+)/);
  const source = m ? m[1] : null;
  const code = source ? source.replace(NS, '') : null;
  const key = Object.keys(CODES).find((k) => CODES[k] === code) || null;
  return { kind, c2pa: kind ? hasC2pa(buf, kind) : false, xmp, source, key };
}

// read() for a file on disk. A big MP4 or MOV is not loaded whole: its top-level boxes are walked
// and only the small 'uuid' and 'jumb' boxes are read.
function readPath(file) {
  const fs = require('fs');
  let fd = null;
  try {
    const size = fs.statSync(file).size;
    if (size <= 32 * 1024 * 1024) return read(fs.readFileSync(file));
    fd = fs.openSync(file, 'r');
    const head = Buffer.alloc(16);
    fs.readSync(fd, head, 0, 16, 0);
    if (kindOf(Buffer.concat([head, Buffer.alloc(16)])) !== 'mp4') return { kind: null, c2pa: false, xmp: null, source: null, key: null };
    const picked = [];
    let off = 0;
    while (off + 8 <= size && picked.length < 64) {
      fs.readSync(fd, head, 0, 16, off);
      let len = head.readUInt32BE(0);
      const type = head.toString('latin1', 4, 8);
      if (len === 1) len = Number(head.readBigUInt64BE(8));
      else if (len === 0) len = size - off;
      if (len < 8 || off + len > size) break;
      if ((type === 'uuid' || type === 'jumb') && len <= 1024 * 1024) {
        const b = Buffer.alloc(len);
        fs.readSync(fd, b, 0, len, off);
        picked.push(b);
      }
      off += len;
    }
    // The picked boxes after a stand-in ftyp, so read() sees an MP4 made of just those boxes.
    const ftyp = Buffer.from('000000106674797069736f6d00000200', 'hex');
    const r = read(Buffer.concat([ftyp, ...picked]));
    return r;
  } catch {
    return { kind: null, c2pa: false, xmp: null, source: null, key: null };
  } finally {
    if (fd != null) fs.closeSync(fd);
  }
}

// Is this file (a Buffer or a path; as tagged) AI-made in whole or part?
function isAi(buffer) {
  const r = typeof buffer === 'string' ? readPath(buffer) : read(buffer);
  return r.key === 'ai' || r.key === 'mixed';
}

// The source for an edit: 'mixed' when any part is AI-made, else 'composite'.
const editSource = (anyAi) => (anyAi ? 'mixed' : 'composite');

// save.saveFile with the tag written into images and videos first. Other files pass through.
async function saveMedia(ctx, name, data, { source = 'mixed', type } = {}) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const media = /\.(mp4|mov|png|jpe?g|webp)$/i.test(String(name));
  return save.saveFile(ctx, name, media ? tag(buf, { type, source }) : data, type);
}

module.exports = { tag, read, readPath, isAi, hasC2pa, saveMedia, editSource, urlFor, kindOf, xmpPacket, CODES, NS, XMP_UUID, C2PA_UUID };
