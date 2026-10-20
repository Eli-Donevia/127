// Runs inside every app this pack makes (inlined into the HTML, never required by Node).
// Pure helpers first; anything that touches the page checks for a document, so tests can run this
// file in a plain vm context. Plain ES5 so the apps work on older phones.
/* eslint-disable no-var */
var C = {};
if (typeof document !== 'undefined') {
  try {
    C = JSON.parse(document.getElementById('app-config').textContent);
  } catch (e) {
    C = {};
  }
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function num(v, d) {
  var n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, ''));
  return isFinite(n) ? n : d === undefined ? 0 : d;
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function money(n) {
  var v = round2(num(n));
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: C.currency || 'USD' }).format(v);
  } catch (e) {
    return '$' + v.toFixed(2);
  }
}

function csvCell(v) {
  var s = String(v == null ? '' : v);
  return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// rows: array of objects; cols: [{ key, label }]
function toCsv(rows, cols) {
  var lines = [cols.map(function (c) { return csvCell(c.label); }).join(',')];
  rows.forEach(function (r) {
    lines.push(cols.map(function (c) { return csvCell(r[c.key]); }).join(','));
  });
  return lines.join('\r\n') + '\r\n';
}

// Tab separated, for pasting straight into a spreadsheet.
function toTsv(rows, cols) {
  var clean = function (v) { return String(v == null ? '' : v).replace(/[\t\r\n]+/g, ' '); };
  var lines = [cols.map(function (c) { return clean(c.label); }).join('\t')];
  rows.forEach(function (r) {
    lines.push(cols.map(function (c) { return clean(r[c.key]); }).join('\t'));
  });
  return lines.join('\n');
}

function todayStr() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Saved only in this browser, under this app's own key.
var store = {
  get: function (k, d) {
    try {
      var v = localStorage.getItem((C.key || 'app') + ':' + k);
      return v == null ? d : JSON.parse(v);
    } catch (e) {
      return d;
    }
  },
  set: function (k, v) {
    try {
      localStorage.setItem((C.key || 'app') + ':' + k, JSON.stringify(v));
      return true;
    } catch (e) {
      return false;
    }
  },
};

function $(s, r) {
  return (r || document).querySelector(s);
}

function $$(s, r) {
  return Array.prototype.slice.call((r || document).querySelectorAll(s));
}

function toast(t) {
  var el = $('#toast');
  if (!el) return;
  el.textContent = t;
  el.className = 'toast show';
  clearTimeout(toast.t);
  toast.t = setTimeout(function () { el.className = 'toast'; }, 1800);
}

function copyText(t) {
  function fallback() {
    var a = document.createElement('textarea');
    a.value = t;
    a.setAttribute('readonly', '');
    a.style.position = 'fixed';
    a.style.opacity = '0';
    document.body.appendChild(a);
    a.select();
    try {
      document.execCommand('copy');
      toast('Copied');
    } catch (e) {
      toast('Select the text and copy it');
    }
    document.body.removeChild(a);
  }
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(t).then(function () { toast('Copied'); }, fallback);
  } else fallback();
}

function download(name, body, type) {
  var b = new Blob(['\ufeff' + body], { type: type || 'text/csv;charset=utf-8' });
  var u = URL.createObjectURL(b);
  var a = document.createElement('a');
  a.href = u;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(function () {
    URL.revokeObjectURL(u);
    document.body.removeChild(a);
  }, 500);
}

if (typeof document !== 'undefined') {
  document.documentElement.className += ' js';
}
