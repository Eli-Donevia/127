// Spreadsheets as CSV with working formulas. A CSV opened in Google Sheets (File, Import) or Excel
// keeps cells that start with "=" as live formulas, so the member's inputs at the top drive every
// row below. Only functions every app shares: SUM, SUMIFS, ROUND, ROUNDUP, ROUNDDOWN, MAX, MIN, IF,
// AND, OR, DATE, MONTH, YEAR.
//
// build: const s = new Sheet(); const r = s.row(['Price per job', 150]); s.ref(r, 2, true) -> "$B$5"
// check: evaluate(csvText) computes every formula the way a spreadsheet does (tests use it to prove
// the formulas give the same numbers as the tool's own math).

const { files } = require('../../_kit');

function colName(n) {
  let s = '';
  let x = n;
  while (x > 0) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

function colNumber(name) {
  let n = 0;
  for (const ch of name.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

// Member-typed text must never start a formula (=, +, -, @) when the CSV opens.
function safeText(v) {
  if (typeof v !== 'string') return v;
  if (v.startsWith('=')) return v; // our own formulas
  return v.replace(/^[+\-@\s]+(?=\S)/, '');
}

class Sheet {
  constructor() {
    this.rows = [];
  }

  // Adds a row of cells (strings, numbers, '=formulas', or null). Returns its 1-based row number.
  row(cells = []) {
    this.rows.push(cells.map((c) => (c == null ? '' : typeof c === 'number' ? (Number.isFinite(c) ? c : '') : c)));
    return this.rows.length;
  }

  blank() {
    return this.row([]);
  }

  get next() {
    return this.rows.length + 1;
  }

  // "B5", or "$B$5" when abs.
  ref(row, col, abs = false) {
    return abs ? `$${colName(col)}$${row}` : `${colName(col)}${row}`;
  }

  range(r1, c1, r2, c2, abs = true) {
    return `${this.ref(r1, c1, abs)}:${this.ref(r2, c2, abs)}`;
  }

  toCsv() {
    const width = Math.max(1, ...this.rows.map((r) => r.length));
    const lines = this.rows.map((r) => {
      const cells = [];
      for (let i = 0; i < width; i++) {
        const v = r[i] == null ? '' : r[i];
        cells.push(typeof v === 'string' && !v.startsWith('=') ? files.csvCell(safeText(v)) : files.csvCell(v));
      }
      return cells.join(',');
    });
    return `${lines.join('\r\n')}\r\n`;
  }
}

// ---------- reading a CSV back and computing it (tests, and checks before saving) ----------

function parseCsv(textIn) {
  const t = String(textIn).replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (quoted) {
      if (ch === '"') {
        if (t[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const ERR = (code) => ({ error: code });
const isErr = (v) => v && typeof v === 'object' && 'error' in v;

// A literal cell the way a spreadsheet reads it: "27%" -> 0.27, "150" -> 150, "" -> empty.
function literal(s) {
  if (s === '' || s == null) return { empty: true };
  const p = String(s).match(/^\s*(-?\d+(?:\.\d+)?)\s*%\s*$/);
  if (p) return Number(p[1]) / 100;
  if (/^\s*-?\d+(\.\d+)?\s*$/.test(s)) return Number(s);
  return String(s);
}

function tokenize(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    let m;
    const rest = src.slice(i);
    if ((m = rest.match(/^\$?[A-Z]{1,3}\$?\d+(?::\$?[A-Z]{1,3}\$?\d+)?/))) {
      out.push({ t: 'ref', v: m[0] });
      i += m[0].length;
    } else if ((m = rest.match(/^[A-Z][A-Z0-9.]*(?=\()/))) {
      out.push({ t: 'fn', v: m[0] });
      i += m[0].length;
    } else if ((m = rest.match(/^\d+(\.\d+)?%?/))) {
      out.push({ t: 'num', v: m[0].endsWith('%') ? Number(m[0].slice(0, -1)) / 100 : Number(m[0]) });
      i += m[0].length;
    } else if (ch === '"') {
      let j = i + 1;
      let s = '';
      while (j < src.length) {
        if (src[j] === '"' && src[j + 1] === '"') {
          s += '"';
          j += 2;
        } else if (src[j] === '"') break;
        else s += src[j++];
      }
      out.push({ t: 'str', v: s });
      i = j + 1;
    } else if ((m = rest.match(/^(<=|>=|<>|[-+*/^(),=<>&])/))) {
      out.push({ t: 'op', v: m[0] });
      i += m[0].length;
    } else if ((m = rest.match(/^(TRUE|FALSE)\b/))) {
      out.push({ t: 'bool', v: m[0] === 'TRUE' });
      i += m[0].length;
    } else throw new Error(`Can't read formula near "${rest.slice(0, 12)}"`);
  }
  return out;
}

function parseFormula(src) {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const take = (v) => {
    const t = toks[p];
    if (v && (!t || t.v !== v)) throw new Error(`Expected ${v} in ${src}`);
    p++;
    return t;
  };
  function primary() {
    const t = peek();
    if (!t) throw new Error(`Formula ends early: ${src}`);
    if (t.t === 'num' || t.t === 'str' || t.t === 'bool') {
      p++;
      return { k: 'lit', v: t.v };
    }
    if (t.t === 'ref') {
      p++;
      return { k: 'ref', v: t.v };
    }
    if (t.t === 'fn') {
      p++;
      take('(');
      const args = [];
      if (peek() && peek().v !== ')') {
        args.push(cmp());
        while (peek() && peek().v === ',') {
          take(',');
          args.push(cmp());
        }
      }
      take(')');
      return { k: 'fn', name: t.v, args };
    }
    if (t.v === '(') {
      take('(');
      const e = cmp();
      take(')');
      return e;
    }
    if (t.v === '-' || t.v === '+') {
      p++;
      const e = primary();
      return t.v === '-' ? { k: 'neg', e } : e;
    }
    throw new Error(`Unexpected ${t.v} in ${src}`);
  }
  function pow() {
    let l = primary();
    while (peek() && peek().v === '^') {
      take('^');
      l = { k: 'bin', op: '^', l, r: primary() };
    }
    return l;
  }
  function mul() {
    let l = pow();
    while (peek() && (peek().v === '*' || peek().v === '/')) {
      const op = take().v;
      l = { k: 'bin', op, l, r: pow() };
    }
    return l;
  }
  function add() {
    let l = mul();
    while (peek() && (peek().v === '+' || peek().v === '-')) {
      const op = take().v;
      l = { k: 'bin', op, l, r: mul() };
    }
    return l;
  }
  function cat() {
    let l = add();
    while (peek() && peek().v === '&') {
      take('&');
      l = { k: 'bin', op: '&', l, r: add() };
    }
    return l;
  }
  function cmp() {
    const l = cat();
    if (peek() && ['=', '<>', '<', '>', '<=', '>='].includes(peek().v)) {
      const op = take().v;
      return { k: 'bin', op, l, r: cat() };
    }
    return l;
  }
  const tree = cmp();
  if (p !== toks.length) throw new Error(`Extra text in formula: ${src}`);
  return tree;
}

function addrOf(ref) {
  const m = ref.replace(/\$/g, '').match(/^([A-Z]+)(\d+)$/);
  return { col: colNumber(m[1]), row: Number(m[2]) };
}

// Excel's date serial (1900 system) for y, m, d.
function serial(y, m, d) {
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 864e5);
}

function fromSerial(n) {
  const t = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 864e5);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

function roundHalfAway(v, digits) {
  const f = 10 ** digits;
  return (Math.sign(v) * Math.round(Math.abs(v) * f + 1e-9)) / f;
}

// Computes every cell. Returns { value(ref), grid } where formula errors show as { error }.
function evaluate(csvText) {
  const raw = parseCsv(csvText);
  const memo = new Map();
  const visiting = new Set();

  function cell(row, col) {
    const key = `${row}:${col}`;
    if (memo.has(key)) return memo.get(key);
    if (visiting.has(key)) return ERR('#CIRCULAR');
    const src = raw[row - 1] ? raw[row - 1][col - 1] : '';
    let v;
    if (typeof src === 'string' && src.startsWith('=')) {
      visiting.add(key);
      try {
        v = run(parseFormula(src.slice(1)));
        if (Array.isArray(v)) v = ERR('#VALUE');
        if (v && v.empty) v = 0;
      } catch (e) {
        v = isErr(e) ? e : ERR(`#PARSE ${e.message}`);
      }
      visiting.delete(key);
    } else v = literal(src);
    memo.set(key, v);
    return v;
  }

  function rangeValues(ref) {
    const [a, b] = ref.split(':');
    const A = addrOf(a);
    const B = addrOf(b);
    const out = [];
    for (let r = Math.min(A.row, B.row); r <= Math.max(A.row, B.row); r++) for (let c = Math.min(A.col, B.col); c <= Math.max(A.col, B.col); c++) out.push(cell(r, c));
    return out;
  }

  const num = (v) => {
    if (isErr(v)) throw v;
    if (v && v.empty) return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    throw ERR('#VALUE');
  };
  const flat = (args) => args.flatMap((a) => (Array.isArray(a) ? a : [a]));
  const text = (v) => (v && v.empty ? '' : typeof v === 'number' ? String(v) : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : String(v));

  function compare(op, a, b) {
    const av = a && a.empty ? (typeof b === 'number' ? 0 : '') : a;
    const bv = b && b.empty ? (typeof a === 'number' ? 0 : '') : b;
    let c;
    if (typeof av === 'number' && typeof bv === 'number') c = av - bv;
    else if (typeof av === 'string' && typeof bv === 'string') c = av.toLowerCase() < bv.toLowerCase() ? -1 : av.toLowerCase() > bv.toLowerCase() ? 1 : 0;
    else c = typeof av === 'number' ? -1 : 1;
    return { '=': c === 0, '<>': c !== 0, '<': c < 0, '>': c > 0, '<=': c <= 0, '>=': c >= 0 }[op];
  }

  function matches(v, crit) {
    const m = String(crit).match(/^(<=|>=|<>|<|>|=)?(.*)$/);
    const op = m[1] || '=';
    const target = literal(m[2]);
    return compare(op, v, target && target.empty ? '' : target);
  }

  const FN = {
    SUM: (args) => flat(args).reduce((n, v) => (isErr(v) ? (() => { throw v; })() : typeof v === 'number' ? n + v : n), 0),
    MAX: (args) => {
      const ns = flat(args).filter((v) => typeof v === 'number');
      return ns.length ? Math.max(...ns) : 0;
    },
    MIN: (args) => {
      const ns = flat(args).filter((v) => typeof v === 'number');
      return ns.length ? Math.min(...ns) : 0;
    },
    ROUND: ([v, d]) => roundHalfAway(num(v), num(d)),
    ROUNDUP: ([v, d]) => {
      const f = 10 ** num(d);
      const x = num(v);
      return (Math.sign(x) * Math.ceil(Math.abs(x) * f - 1e-9)) / f;
    },
    ROUNDDOWN: ([v, d]) => {
      const f = 10 ** num(d);
      const x = num(v);
      return (Math.sign(x) * Math.floor(Math.abs(x) * f + 1e-9)) / f;
    },
    ABS: ([v]) => Math.abs(num(v)),
    IF: ([c, a, b]) => (num(c) ? (a === undefined ? true : a) : b === undefined ? false : b),
    AND: (args) => flat(args).every((v) => num(v)),
    OR: (args) => flat(args).some((v) => num(v)),
    DATE: ([y, m, d]) => serial(num(y), num(m), num(d)),
    MONTH: ([v]) => fromSerial(num(v)).m,
    YEAR: ([v]) => fromSerial(num(v)).y,
    SUMIFS: ([sumRange, ...pairs]) => {
      let total = 0;
      sumRange.forEach((v, i) => {
        for (let k = 0; k < pairs.length; k += 2) if (!matches(pairs[k][i], text(pairs[k + 1]))) return;
        if (typeof v === 'number') total += v;
      });
      return total;
    },
  };

  function run(n) {
    switch (n.k) {
      case 'lit':
        return n.v;
      case 'ref':
        if (n.v.includes(':')) return rangeValues(n.v);
        {
          const a = addrOf(n.v);
          const v = cell(a.row, a.col);
          if (isErr(v)) throw v;
          return v;
        }
      case 'neg':
        return -num(run(n.e));
      case 'fn': {
        const f = FN[n.name];
        if (!f) throw ERR(`#NAME ${n.name}`);
        if (n.name === 'IF') {
          const c = run(n.args[0]);
          const pick = num(c) ? n.args[1] : n.args[2];
          return pick === undefined ? !!num(c) : run(pick);
        }
        return f(n.args.map(run));
      }
      case 'bin': {
        const l = run(n.l);
        const r = run(n.r);
        if (n.op === '&') return text(l) + text(r);
        if (['=', '<>', '<', '>', '<=', '>='].includes(n.op)) return compare(n.op, l, r);
        const a = num(l);
        const b = num(r);
        if (n.op === '+') return a + b;
        if (n.op === '-') return a - b;
        if (n.op === '*') return a * b;
        if (n.op === '/') {
          if (b === 0) throw ERR('#DIV/0');
          return a / b;
        }
        if (n.op === '^') return a ** b;
        throw ERR('#OP');
      }
      default:
        throw ERR('#NODE');
    }
  }

  const wrapped = (row, col) => {
    try {
      return cell(row, col);
    } catch (e) {
      return isErr(e) ? e : ERR(String(e.message || e));
    }
  };
  const value = (ref) => {
    const a = addrOf(ref);
    const v = wrapped(a.row, a.col);
    return v && v.empty ? '' : v;
  };
  // Every formula cell that ends in an error.
  const errors = () => {
    const out = [];
    raw.forEach((r, i) =>
      r.forEach((src, j) => {
        if (typeof src === 'string' && src.startsWith('=')) {
          let v;
          try {
            v = cell(i + 1, j + 1);
          } catch (e) {
            v = isErr(e) ? e : ERR(String(e));
          }
          if (isErr(v)) out.push(`${colName(j + 1)}${i + 1}: ${v.error} (${src})`);
        }
      })
    );
    return out;
  };
  return { value, errors, rows: raw };
}

module.exports = { Sheet, colName, colNumber, safeText, parseCsv, evaluate, serial, fromSerial };
