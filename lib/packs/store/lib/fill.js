// The "Make it mine" filler (STORE-SCHEMA.md, Tokens): puts the member's values into a Store file's
// tokens, escaped the way that file type needs, and sets xlsx cells. Pure code: no AI, no network.
// The clean downloads are built by the Templates thread's build_store.py with the same rules, so a
// filled file reads exactly like the clean one with the member's words in place of "[Your business]".
//
//   {{business.name}}            the value, or the token's default fallback when there is none
//   {{business.name|Your shop}}  the value, or this fallback
//
// Only the schema's tokens are filled. Anything else in braces stays as written: Liquid's
// {{ product.title }} (spaces never match), {{product.title}} (not a Store token) and {% tags %}.

const path = require('path');
const { files } = require('../../_kit');

const TOKEN = /\{\{([a-z]+\.[a-z]+|today|year)(?:\|([^}]*))?\}\}/g;
const HEX = /^#[0-9A-Fa-f]{6}$/;
const LIQUID_SCHEMA = /\{%-?\s*schema\s*-?%\}[\s\S]*?\{%-?\s*endschema\s*-?%\}/g;
const MAX_ZIP_DEPTH = 3;

// The XML parts of an Office file that hold the words a member reads.
const PARTS = {
  docx: (n) => /^word\/(document|header\d*|footer\d*)\.xml$/.test(n) || n === 'docProps/core.xml',
  xlsx: (n) => n === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/.test(n),
  pptx: (n) => /^ppt\/slides\/slide\d+\.xml$/.test(n),
};
const MODES = { html: 'html', htm: 'html', svg: 'html', xml: 'html', liquid: 'liquid', md: 'text', txt: 'text', csv: 'csv', json: 'json', docx: 'docx', xlsx: 'xlsx', pptx: 'pptx', zip: 'zip' };

const oneLine = (s) => String(s).replace(/\r\n|\r|\n/g, ' ');
const xmlEsc = (s) => files.esc(oneLine(s));

function modeFor(name) {
  const ext = path.extname(String(name)).toLowerCase().replace(/^\./, '');
  return MODES[ext] || null;
}

// How a value (or a fallback) is written in each kind of file.
function escFor(mode, v) {
  const s = String(v);
  if (mode === 'html' || mode === 'xml') return xmlEsc(s); // newlines in markup and Office runs read as spaces anyway
  if (mode === 'liquid') return files.esc(oneLine(s));
  if (mode === 'json') return JSON.stringify(oneLine(s)).slice(1, -1);
  if (mode === 'text') return oneLine(s);
  return s; // csv: the plain words; the field is quoted afterwards (fillCsv)
}

// A report collects which tokens got the member's value and which fell back.
function report() {
  return { used: new Set(), missing: new Set() };
}

function valueOf(values, key) {
  const v = values && Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
  if (v == null) return '';
  const s = String(v).trim();
  if (key === 'brand.color' && !HEX.test(s)) return '';
  return s;
}

// opts: { values, tokens (the schema's table: label and fallback per token), report }
function fillString(text, mode, opts) {
  const { values, tokens, report: rep } = opts;
  return String(text).replace(TOKEN, (m, key, fb) => {
    if (!tokens || !Object.prototype.hasOwnProperty.call(tokens, key)) return m;
    const v = valueOf(values, key);
    if (v) {
      if (rep) rep.used.add(key);
      return escFor(mode, v);
    }
    if (rep) rep.missing.add(key);
    return escFor(mode, fb !== undefined ? fb : tokens[key].fallback || `[${key}]`);
  });
}

// Liquid: JSON-escaped inside {% schema %}...{% endschema %} (the theme editor shows those
// defaults as typed), HTML-escaped everywhere else. Newlines become spaces in both.
function fillLiquid(text, opts) {
  let out = '';
  let last = 0;
  for (const m of String(text).matchAll(LIQUID_SCHEMA)) {
    out += fillString(text.slice(last, m.index), 'liquid', opts);
    out += fillString(m[0], 'json', opts);
    last = m.index + m[0].length;
  }
  return out + fillString(text.slice(last), 'liquid', opts);
}

// CSV: each field that holds a token is unquoted, filled with the plain words, then written back
// as one CSV field (quoted when it needs to be, or when it was). Every other byte stays as it was.
function fillCsv(text, opts) {
  let s = String(text);
  let bom = '';
  if (s.charCodeAt(0) === 0xfeff) {
    bom = '﻿';
    s = s.slice(1);
  }
  const hasToken = (v) => new RegExp(TOKEN.source).test(v);
  let out = '';
  let i = 0;
  const n = s.length;
  const endOfField = (k) => k >= n || s[k] === ',' || s[k] === '\n' || s[k] === '\r';
  while (i < n) {
    const start = i;
    let value = '';
    let quoted = false;
    if (s[i] === '"') {
      quoted = true;
      let j = i + 1;
      while (j < n) {
        if (s[j] === '"') {
          if (s[j + 1] === '"') {
            value += '"';
            j += 2;
            continue;
          }
          j += 1;
          break;
        }
        value += s[j];
        j += 1;
      }
      while (!endOfField(j)) value += s[j++];
      i = j;
    } else {
      while (!endOfField(i)) i += 1;
      value = s.slice(start, i);
    }
    const raw = s.slice(start, i);
    if (hasToken(value)) {
      const filled = fillString(value, 'csv', opts);
      out += quoted ? `"${filled.replace(/"/g, '""')}"` : files.csvCell(filled);
    } else out += raw;
    if (i < n) {
      if (s[i] === '\r' && s[i + 1] === '\n') {
        out += '\r\n';
        i += 2;
      } else {
        out += s[i];
        i += 1;
      }
    }
  }
  return bom + out;
}

// Reads a zip with the kit's unzip, and only when it read the whole thing (the count in the zip's
// own directory must match), so a half-read file is never saved.
function readZip(buf) {
  let entries;
  try {
    entries = files.unzip(buf);
  } catch {
    entries = null;
  }
  let end = -1;
  for (let p = buf.length - 22; p >= Math.max(0, buf.length - 65557); p--) {
    if (buf.readUInt32LE(p) === 0x06054b50) {
      end = p;
      break;
    }
  }
  if (entries && end >= 0 && buf.readUInt16LE(end + 10) === entries.length) return entries;
  // A zip the kit's reader can't walk (sizes after the data, as some apps write them): read it from
  // its central directory instead (lib/harness/zipfile.js).
  try {
    return require('../../../harness/zipfile').readZip(buf);
  } catch {
    throw new Error("That template couldn't be opened to fill in. Download the clean file instead.");
  }
}

// Fills one file by its name. Returns a Buffer. A type the schema doesn't fill comes back as is.
function fillBuffer(name, buf, opts, depth = 0) {
  const mode = modeFor(name);
  const text = () => Buffer.from(buf).toString('utf8');
  if (mode === 'html' || mode === 'text' || mode === 'json') return Buffer.from(fillString(text(), mode, opts), 'utf8');
  if (mode === 'liquid') return Buffer.from(fillLiquid(text(), opts), 'utf8');
  if (mode === 'csv') return Buffer.from(fillCsv(text(), opts), 'utf8');
  if (mode === 'docx' || mode === 'xlsx' || mode === 'pptx') {
    const entries = readZip(buf).map((e) => (PARTS[mode](e.name) ? { name: e.name, data: Buffer.from(fillString(e.data.toString('utf8'), 'xml', opts), 'utf8') } : e));
    return files.zip(entries, { mtime: opts.now || Date.UTC(2026, 0, 1) });
  }
  if (mode === 'zip') {
    if (depth >= MAX_ZIP_DEPTH) return buf;
    const entries = readZip(buf).map((e) => (e.name.endsWith('/') || !modeFor(e.name) ? e : { name: e.name, data: fillBuffer(e.name, e.data, opts, depth + 1) }));
    return files.zip(entries, { mtime: opts.now || Date.UTC(2026, 0, 1) });
  }
  return buf;
}

// ---------- xlsx cells (makeItMine.cells) ----------

const unXml = (s) => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&amp;/g, '&');
const attr = (attrs, name) => {
  const m = String(attrs).match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`));
  return m ? unXml(m[1]) : null;
};
const colNum = (letters) => letters.split('').reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0);
const splitRef = (ref) => {
  const m = String(ref).match(/^([A-Z]{1,3})([1-9][0-9]*)$/);
  return m ? { col: m[1], row: Number(m[2]) } : null;
};

// "$45/mo" -> 45, "1,250.50" -> 1250.5. Null when there's no number.
function firstNumber(s) {
  const m = String(s).match(/-?\d[\d,]*(?:\.\d+)?|-?\.\d+/);
  if (!m) return null;
  const n = Number(m[0].replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

// Sheet name -> the worksheet part, through xl/workbook.xml and its rels.
function sheetParts(byName) {
  const wb = byName.get('xl/workbook.xml');
  const rels = byName.get('xl/_rels/workbook.xml.rels');
  if (!wb || !rels) return {};
  const targets = {};
  for (const m of rels.data.toString('utf8').matchAll(/<Relationship\b([^>]*?)\/?>/g)) {
    const id = attr(m[1], 'Id');
    let target = attr(m[1], 'Target');
    if (!id || !target) continue;
    target = target.startsWith('/') ? target.slice(1) : path.posix.normalize(`xl/${target}`);
    targets[id] = target;
  }
  const out = {};
  for (const m of wb.data.toString('utf8').matchAll(/<sheet\b([^>]*?)\/?>/g)) {
    const name = attr(m[1], 'name');
    const rid = (m[1].match(/\s[\w]+:id="([^"]*)"/) || [])[1];
    if (name != null && rid && targets[rid]) out[name] = targets[rid];
  }
  return out;
}

function cellXml(attrs, value, number) {
  const keep = String(attrs).replace(/\s(?:t|cm|vm)="[^"]*"/g, '');
  if (number) return `<c${keep}><v>${value}</v></c>`;
  return `<c${keep} t="inlineStr"><is><t xml:space="preserve">${xmlEsc(value)}</t></is></c>`;
}

// Sets one cell in a worksheet's XML: replaces the cell if it's there, else adds it to its row in
// column order (adding the row in row order if needed). Returns { xml, hadFormula }.
function setCell(xml, ref, value, number) {
  const cellRe = new RegExp(`<c\\b(?=[^>]*\\sr="${ref}")([^>]*?)(\\/>|>([\\s\\S]*?)<\\/c>)`);
  const hit = xml.match(cellRe);
  if (hit) return { xml: xml.replace(cellRe, () => cellXml(hit[1], value, number)), hadFormula: /<f[\s>/]/.test(hit[3] || '') };
  const { col, row } = splitRef(ref);
  const fresh = cellXml(` r="${ref}"`, value, number);
  const rowRe = new RegExp(`<row\\b(?=[^>]*\\sr="${row}")([^>]*?)(\\/>|>([\\s\\S]*?)<\\/row>)`);
  const r = xml.match(rowRe);
  if (r) {
    if (r[2] === '/>') return { xml: xml.replace(rowRe, () => `<row${r[1]}>${fresh}</row>`), hadFormula: false };
    const inner = r[3];
    let at = inner.length;
    for (const c of inner.matchAll(/<c\b[^>]*\sr="([A-Z]{1,3})\d+"/g)) {
      if (colNum(c[1]) > colNum(col)) {
        at = c.index;
        break;
      }
    }
    return { xml: xml.replace(rowRe, () => `<row${r[1]}>${inner.slice(0, at)}${fresh}${inner.slice(at)}</row>`), hadFormula: false };
  }
  const newRow = `<row r="${row}">${fresh}</row>`;
  if (/<sheetData\s*\/>/.test(xml)) return { xml: xml.replace(/<sheetData\s*\/>/, `<sheetData>${newRow}</sheetData>`), hadFormula: false };
  const sd = xml.match(/<sheetData\b[^>]*>([\s\S]*?)<\/sheetData>/);
  if (!sd) throw new Error("That spreadsheet couldn't be filled in. Download the clean file instead.");
  let pos = xml.indexOf('</sheetData>');
  const base = sd.index + sd[0].indexOf('>') + 1;
  for (const m of sd[1].matchAll(/<row\b[^>]*\sr="(\d+)"/g)) {
    if (Number(m[1]) > row) {
      pos = base + m.index;
      break;
    }
  }
  return { xml: xml.slice(0, pos) + newRow + xml.slice(pos), hadFormula: false };
}

// cells: [{ cell: 'Tab!B3', value: 'First-Sale Math: {{business.name}}', number }].
// A cell whose tokens don't all have the member's value is left as it is. Returns
// { data, set: ['Tab!B3'], left: ['Math!C5'] }.
function setCells(buf, cells, opts) {
  const entries = readZip(buf);
  const byName = new Map(entries.map((e) => [e.name, e]));
  const sheets = sheetParts(byName);
  const set = [];
  const left = [];
  let formulaGone = false;
  for (const c of cells || []) {
    const bang = c.cell.lastIndexOf('!');
    const sheet = c.cell.slice(0, bang).replace(/^'(.*)'$/, '$1');
    const ref = c.cell.slice(bang + 1);
    const keys = [...String(c.value).matchAll(TOKEN)].map((m) => m[1]);
    const missing = keys.filter((k) => !opts.tokens || !Object.prototype.hasOwnProperty.call(opts.tokens, k) || !valueOf(opts.values, k));
    if (missing.length) {
      for (const k of missing) if (opts.report) opts.report.missing.add(k);
      left.push(c.cell);
      continue;
    }
    const part = sheets[sheet] && byName.get(sheets[sheet]);
    if (!part || !splitRef(ref)) {
      left.push(c.cell);
      continue;
    }
    const filled = oneLine(fillString(c.value, 'csv', opts)); // plain words; escaped as XML below
    const n = c.number ? firstNumber(filled) : null;
    const r = setCell(part.data.toString('utf8'), ref, n != null ? String(n) : filled, n != null);
    part.data = Buffer.from(r.xml, 'utf8');
    formulaGone = formulaGone || r.hadFormula;
    set.push(c.cell);
  }
  if (!set.length) return { data: buf, set, left };
  // Recalculate on open, so the sheet's answers follow the new inputs.
  const wb = byName.get('xl/workbook.xml');
  let wx = wb.data.toString('utf8');
  if (/<calcPr\b/.test(wx)) wx = wx.replace(/<calcPr\b([^>]*?)(\/?)>/, (m, a, close) => `<calcPr${a.replace(/\sfullCalcOnLoad="[^"]*"/, '')} fullCalcOnLoad="1"${close}>`);
  else if (/<\/definedNames>/.test(wx)) wx = wx.replace('</definedNames>', '</definedNames><calcPr fullCalcOnLoad="1"/>');
  else wx = wx.replace('</sheets>', '</sheets><calcPr fullCalcOnLoad="1"/>');
  wb.data = Buffer.from(wx, 'utf8');
  let out = entries;
  // A formula cell turned into a value would leave Excel's calculation chain pointing at it.
  if (formulaGone && byName.has('xl/calcChain.xml')) {
    out = entries.filter((e) => e.name !== 'xl/calcChain.xml');
    const ct = byName.get('[Content_Types].xml');
    if (ct) ct.data = Buffer.from(ct.data.toString('utf8').replace(/<Override\b[^>]*PartName="\/xl\/calcChain\.xml"[^>]*\/>/, ''), 'utf8');
    const rels = byName.get('xl/_rels/workbook.xml.rels');
    if (rels) rels.data = Buffer.from(rels.data.toString('utf8').replace(/<Relationship\b[^>]*Target="[^"]*calcChain\.xml"[^>]*\/>/, ''), 'utf8');
  }
  return { data: files.zip(out, { mtime: opts.now || Date.UTC(2026, 0, 1) }), set, left };
}

module.exports = { TOKEN, HEX, PARTS, modeFor, escFor, report, valueOf, fillString, fillLiquid, fillCsv, fillBuffer, readZip, setCells, setCell, firstNumber, sheetParts };
