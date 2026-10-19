// Shopify product CSV: the exact headers from Shopify's own template (data/shopify-csv.json) plus
// the optional Collection column, UTF-8 without a byte order mark, LF line endings, RFC 4180 quoting.
// validate() checks a file against the same spec; the tests run it on everything we generate.

const SPEC = require('../data/shopify-csv.json');

const HEADERS = SPEC.headers.concat(['Collection']);

function cell(v) {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function write(rows) {
  const lines = [HEADERS.map(cell).join(',')];
  for (const r of rows) lines.push(HEADERS.map((h) => cell(r[h])).join(','));
  return `${lines.join('\n')}\n`;
}

// RFC 4180 parser (quotes, doubled quotes, line breaks inside quotes).
function parse(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      row.push(cur);
      cur = '';
    } else if (c === '\n') {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
    } else cur += c;
  }
  if (cur !== '' || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

const HANDLE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function handleOf(title, taken = new Set()) {
  const base =
    String(title || 'product')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80)
      .replace(/-+$/, '') || 'product';
  let h = base;
  for (let i = 2; taken.has(h); i++) h = `${base}-${i}`;
  taken.add(h);
  return h;
}

// Returns a list of problems; empty means the file matches the spec.
function validate(text) {
  const out = [];
  if (text.charCodeAt(0) === 0xfeff) out.push('starts with a byte order mark');
  if (/\r/.test(text)) out.push('has CR line endings (Shopify template uses LF)');
  if (Buffer.byteLength(text, 'utf8') > SPEC.limits.fileSizeMB * 1024 * 1024) out.push('over the file size limit');
  const rows = parse(text);
  const head = rows[0] || [];
  const want = SPEC.headers;
  for (let i = 0; i < want.length; i++) if (head[i] !== want[i]) out.push(`header ${i + 1} is "${head[i]}", expected "${want[i]}"`);
  const extra = head.slice(want.length);
  if (extra.some((h) => h !== 'Collection')) out.push('unknown extra column');
  const col = (r, name) => r[head.indexOf(name)];
  const seen = new Set();
  rows.slice(1).forEach((r, i) => {
    const n = i + 2;
    if (r.length !== head.length) out.push(`row ${n} has ${r.length} cells, header has ${head.length}`);
    const handle = col(r, 'URL handle');
    if (!HANDLE.test(handle || '')) out.push(`row ${n}: bad URL handle "${handle}"`);
    if (!seen.has(handle) && !col(r, 'Title')) out.push(`row ${n}: first row of ${handle} needs a Title`);
    seen.add(handle);
    const price = col(r, 'Price');
    if (price && !/^\d+(\.\d{1,2})?$/.test(price)) out.push(`row ${n}: price "${price}" must be a plain number`);
    for (const [k, vals] of Object.entries(SPEC.values)) {
      const v = col(r, k);
      if (v && !vals.includes(v)) out.push(`row ${n}: ${k} "${v}" is not one of ${vals.join(', ')}`);
    }
    if ((col(r, 'SEO title') || '').length > SPEC.limits.seoTitle) out.push(`row ${n}: SEO title over ${SPEC.limits.seoTitle}`);
    if ((col(r, 'SEO description') || '').length > SPEC.limits.seoDescription) out.push(`row ${n}: SEO description over ${SPEC.limits.seoDescription}`);
    if (col(r, 'Option1 value') && !col(r, 'Option1 name') && !seen.has(`${handle}:o`)) out.push(`row ${n}: Option1 value without Option1 name`);
    if (col(r, 'Option1 name')) seen.add(`${handle}:o`);
    const packed = ['Packed product length', 'Packed product width', 'Packed product height', 'Packed product dimension unit'].map((k) => col(r, k)).filter(Boolean).length;
    if (packed && packed !== 4) out.push(`row ${n}: fill all four packed product columns or none`);
  });
  return out;
}

module.exports = { HEADERS, write, parse, validate, handleOf, HANDLE, SPEC };
