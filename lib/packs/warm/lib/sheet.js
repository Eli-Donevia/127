// A tiny builder for spreadsheet CSVs with working formulas. Cells that start with "=" are
// formulas: Google Sheets, Excel and Numbers calculate them when the CSV is opened or imported.
// Rows are numbered from 1 (the first row), so formulas can point at named rows.

const { files } = require('../../_kit');

function colName(i) {
  let n = i + 1;
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

class Sheet {
  constructor() {
    this.rows = [];
    this.names = {};
  }

  // Adds a row; returns its row number. cells: array of values or (row) => values.
  add(cells, name) {
    const r = this.rows.length + 1;
    const values = typeof cells === 'function' ? cells(r) : cells;
    this.rows.push(values);
    if (name) this.names[name] = r;
    return r;
  }

  blank() {
    return this.add([]);
  }

  row(name) {
    if (!this.names[name]) throw new Error(`No row named ${name}`);
    return this.names[name];
  }

  // $B$7 for the named row (absolute), or B7.
  ref(name, col = 'B', abs = true) {
    const r = this.row(name);
    return abs ? `$${col}$${r}` : `${col}${r}`;
  }

  csv() {
    const width = Math.max(1, ...this.rows.map((r) => r.length));
    const lines = this.rows.map((r) => Array.from({ length: width }, (_, i) => files.csvCell(r[i] == null ? '' : r[i])).join(','));
    return `﻿${lines.join('\r\n')}\r\n`;
  }
}

module.exports = { Sheet, colName };
