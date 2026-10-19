// A small JSON Schema subset for pack inputs, tool outputs and AI answers. No dependencies.
// Supported: type (or a list of types), properties, required, additionalProperties, items, enum,
// const, anyOf, minimum, maximum, minLength, maxLength, minItems, maxItems, pattern, format
// (email, uri, date), default, title, description.
//
// validate(schema, value, { coerce }) fills defaults and returns { ok, value, errors, text }.
// coerce: true is for form and command-line values, which arrive as strings ("12" -> 12).
// forApi(schema) is the same schema in the shape Claude's structured outputs accept: every object
// closed with additionalProperties: false, and the number, length and array constraints removed
// (validate() still checks them on the answer).

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}

function fits(type, v) {
  const t = typeOf(v);
  if (type === 'number') return t === 'number' || t === 'integer';
  if (type === 'object') return t === 'object';
  return t === type;
}

function typesOf(s) {
  if (!s || s.type === undefined) return null;
  return Array.isArray(s.type) ? s.type : [s.type];
}

// Form values arrive as strings. Only obvious conversions; anything else is left for the type check.
function coerceTo(types, v) {
  if (typeof v !== 'string') {
    if (types.includes('array') && v !== undefined && v !== null && !Array.isArray(v)) return [v];
    return v;
  }
  const s = v.trim();
  if ((types.includes('integer') || types.includes('number')) && s !== '' && !types.includes('string')) {
    const n = Number(s.replace(/[$,\s]/g, ''));
    if (Number.isFinite(n)) return n;
  }
  if (types.includes('boolean') && !types.includes('string')) {
    if (/^(true|yes|on|1)$/i.test(s)) return true;
    if (/^(false|no|off|0)$/i.test(s)) return false;
  }
  if (types.includes('array') && !types.includes('string')) {
    const parts = s.includes('\n') ? s.split('\n') : s.split(',');
    return parts.map((p) => p.trim()).filter(Boolean);
  }
  if (types.includes('null') && s === '' && !types.includes('string')) return null;
  return v;
}

const FORMATS = {
  email: (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s),
  uri: (s) => {
    try {
      const u = new URL(s);
      return /^https?:$/.test(u.protocol);
    } catch {
      return false;
    }
  },
  date: (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)),
};

function nameOf(path, s) {
  if (s && s.title) return s.title;
  return path || 'Value';
}

function check(s, v, path, opts, errors) {
  if (!s || typeof s !== 'object') return v;
  if (v === undefined && s.default !== undefined) v = clone(s.default);
  if (v === undefined) return v;

  if (Array.isArray(s.anyOf)) {
    for (const option of s.anyOf) {
      const errs = [];
      const out = check(option, clone(v), path, opts, errs);
      if (!errs.length) return out;
    }
    errors.push({ path, message: `${nameOf(path, s)} isn't in a form we can use.` });
    return v;
  }

  const types = typesOf(s);
  if (types) {
    if (opts.coerce) v = coerceTo(types, v);
    if (!types.some((t) => fits(t, v))) {
      const want = types.filter((t) => t !== 'null').join(' or ');
      errors.push({ path, message: `${nameOf(path, s)} should be ${want === 'integer' ? 'a whole number' : want === 'array' ? 'a list' : want === 'object' ? 'a set of fields' : `a ${want}`}.` });
      return v;
    }
  }

  if (s.const !== undefined && JSON.stringify(v) !== JSON.stringify(s.const)) {
    errors.push({ path, message: `${nameOf(path, s)} has the wrong value.` });
  }
  if (Array.isArray(s.enum) && !s.enum.some((e) => JSON.stringify(e) === JSON.stringify(v))) {
    errors.push({ path, message: `${nameOf(path, s)} should be one of: ${s.enum.join(', ')}.` });
  }

  const t = typeOf(v);
  if (t === 'string') {
    if (opts.trim !== false) v = v.trim();
    if (s.minLength !== undefined && v.length < s.minLength) {
      errors.push({ path, message: s.minLength === 1 ? `${nameOf(path, s)} is required.` : `${nameOf(path, s)} should be at least ${s.minLength} characters.` });
    }
    if (s.maxLength !== undefined && v.length > s.maxLength) {
      if (opts.clip) v = v.slice(0, s.maxLength);
      else errors.push({ path, message: `${nameOf(path, s)} should be ${s.maxLength} characters or fewer.` });
    }
    if (s.pattern) {
      let re = null;
      try {
        re = new RegExp(s.pattern);
      } catch {
        re = null;
      }
      if (re && !re.test(v)) errors.push({ path, message: `${nameOf(path, s)} isn't in the right format.` });
    }
    if (s.format && FORMATS[s.format] && v !== '' && !FORMATS[s.format](v)) {
      errors.push({ path, message: `${nameOf(path, s)} isn't a valid ${s.format === 'uri' ? 'web address' : s.format}.` });
    }
  }
  if (t === 'number' || t === 'integer') {
    if (s.minimum !== undefined && v < s.minimum) errors.push({ path, message: `${nameOf(path, s)} should be ${s.minimum} or more.` });
    if (s.maximum !== undefined && v > s.maximum) errors.push({ path, message: `${nameOf(path, s)} should be ${s.maximum} or less.` });
  }
  if (t === 'array') {
    if (s.minItems !== undefined && v.length < s.minItems) errors.push({ path, message: `${nameOf(path, s)} needs at least ${s.minItems}.` });
    if (s.maxItems !== undefined && v.length > s.maxItems) {
      if (opts.clip) v = v.slice(0, s.maxItems);
      else errors.push({ path, message: `${nameOf(path, s)} can have at most ${s.maxItems}.` });
    }
    if (s.items) v = v.map((item, i) => check(s.items, item, `${path}[${i}]`, opts, errors));
  }
  if (t === 'object') {
    const props = s.properties || {};
    const out = {};
    for (const [k, val] of Object.entries(v)) {
      if (props[k]) continue;
      if (s.additionalProperties === false) {
        if (opts.unknown === 'error') errors.push({ path: path ? `${path}.${k}` : k, message: `${k} isn't expected here.` });
        continue; // dropped
      }
      out[k] = val;
    }
    for (const [k, ps] of Object.entries(props)) {
      const sub = check(ps, v[k], path ? `${path}.${k}` : k, opts, errors);
      if (sub !== undefined) out[k] = sub;
    }
    for (const k of s.required || []) {
      const val = out[k];
      if (val === undefined || val === null || (typeof val === 'string' && val === '' && opts.coerce)) {
        errors.push({ path: path ? `${path}.${k}` : k, message: `${nameOf(path ? `${path}.${k}` : k, props[k])} is required.` });
      }
    }
    v = out;
  }
  return v;
}

function validate(schema, value, opts = {}) {
  const errors = [];
  const out = check(schema, clone(value), '', { coerce: !!opts.coerce, clip: !!opts.clip, unknown: opts.unknown, trim: opts.trim }, errors);
  return { ok: errors.length === 0, value: out, errors, text: errors.map((e) => e.message).join(' ') };
}

// ---------- structured outputs ----------

const API_KEEP = new Set(['type', 'properties', 'required', 'items', 'enum', 'const', 'anyOf', 'allOf', 'description', 'additionalProperties', 'format']);
const API_FORMATS = new Set(['date-time', 'time', 'date', 'duration', 'email', 'hostname', 'uri', 'ipv4', 'ipv6', 'uuid']);

function forApi(schema) {
  const walk = (s) => {
    if (!s || typeof s !== 'object' || Array.isArray(s)) return s;
    const out = {};
    for (const [k, v] of Object.entries(s)) {
      if (!API_KEEP.has(k)) continue;
      if (k === 'properties') out.properties = Object.fromEntries(Object.entries(v || {}).map(([pk, pv]) => [pk, walk(pv)]));
      else if (k === 'items') out.items = walk(v);
      else if (k === 'anyOf' || k === 'allOf') out[k] = v.map(walk);
      else if (k === 'format') {
        if (API_FORMATS.has(v)) out.format = v;
      } else if (k !== 'additionalProperties') out[k] = clone(v);
    }
    const types = typesOf(s) || [];
    if (types.includes('object') || out.properties) {
      out.properties = out.properties || {};
      out.additionalProperties = false;
      if (out.required) out.required = out.required.filter((r) => out.properties[r]);
    }
    if (s.title && !out.description) out.description = s.title;
    return out;
  };
  return walk(schema);
}

// A small valid value for a schema: used by the demo AI (no API key) and by the CLI's sample runs.
function example(s, depth = 0) {
  if (!s || typeof s !== 'object' || depth > 8) return null;
  if (s.default !== undefined) return clone(s.default);
  if (s.const !== undefined) return clone(s.const);
  if (Array.isArray(s.enum) && s.enum.length) return clone(s.enum[0]);
  if (Array.isArray(s.anyOf) && s.anyOf.length) return example(s.anyOf[0], depth + 1);
  const types = typesOf(s) || (s.properties ? ['object'] : ['string']);
  const t = types.find((x) => x !== 'null') || 'null';
  if (t === 'object') {
    const out = {};
    for (const [k, ps] of Object.entries(s.properties || {})) out[k] = example(ps, depth + 1);
    return out;
  }
  if (t === 'array') {
    const n = Math.max(s.minItems || 0, Math.min(s.maxItems === undefined ? 2 : s.maxItems, 2));
    return Array.from({ length: n }, () => example(s.items || { type: 'string' }, depth + 1));
  }
  if (t === 'integer' || t === 'number') return s.minimum !== undefined ? s.minimum : s.maximum !== undefined ? Math.min(s.maximum, 1) : 1;
  if (t === 'boolean') return true;
  if (t === 'null') return null;
  if (s.format === 'uri') return 'https://example.com';
  if (s.format === 'email') return 'name@example.com';
  if (s.format === 'date') return '2026-11-17';
  const text = 'Sample text';
  return s.minLength && s.minLength > text.length ? text.padEnd(s.minLength, '.') : s.maxLength ? text.slice(0, s.maxLength) : text;
}

// Load-time check that a pack's schema is one this file can read.
function lint(s, path = 'schema') {
  const problems = [];
  const walk = (x, p, depth) => {
    if (depth > 12) return problems.push(`${p} is nested too deeply.`);
    if (!x || typeof x !== 'object' || Array.isArray(x)) return problems.push(`${p} should be an object.`);
    const types = typesOf(x);
    const known = ['string', 'number', 'integer', 'boolean', 'object', 'array', 'null'];
    if (types && types.some((t) => !known.includes(t))) problems.push(`${p}.type has an unknown type.`);
    if (x.$ref) problems.push(`${p} uses $ref, which the harness doesn't read. Write the schema out.`);
    if (x.properties) for (const [k, v] of Object.entries(x.properties)) walk(v, `${p}.properties.${k}`, depth + 1);
    if (x.items) walk(x.items, `${p}.items`, depth + 1);
    if (x.anyOf) x.anyOf.forEach((o, i) => walk(o, `${p}.anyOf[${i}]`, depth + 1));
    if (x.required && !Array.isArray(x.required)) problems.push(`${p}.required should be a list.`);
    if (x.pattern) {
      try {
        new RegExp(x.pattern);
      } catch {
        problems.push(`${p}.pattern isn't a valid pattern.`);
      }
    }
  };
  walk(s, path, 0);
  return problems;
}

module.exports = { validate, forApi, example, lint, typeOf };
