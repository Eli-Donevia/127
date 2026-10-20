// A small CSV reader (RFC 4180 quotes, commas, semicolons or tabs, a BOM, blank lines skipped).
// Returns { columns, rows } with every cell as a trimmed string.

function detect(textIn) {
  const first = String(textIn).split(/\r?\n/).find((l) => l.trim()) || '';
  const count = (ch) => first.split(ch).length - 1;
  const opts = [[',', count(',')], [';', count(';')], ['\t', count('\t')]].sort((a, b) => b[1] - a[1]);
  return opts[0][1] > 0 ? opts[0][0] : ',';
}

function parseCsv(input, { delimiter, maxRows = 5000 } = {}) {
  const s = String(input || '').replace(/^\ufeff/, '');
  const d = delimiter || detect(s);
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"' && cell.trim() === '') {
      q = true;
      cell = '';
    } else if (ch === d) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
      if (rows.length > maxRows) break;
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  const header = (rows.shift() || []).map((h, i) => String(h).trim() || `Column ${i + 1}`);
  const width = header.length;
  const body = rows.slice(0, maxRows).map((r) => {
    const out = r.slice(0, width).map((c) => String(c).trim());
    while (out.length < width) out.push('');
    return out;
  });
  return { columns: header, rows: body, truncated: rows.length > maxRows };
}

module.exports = { parseCsv, detect };
