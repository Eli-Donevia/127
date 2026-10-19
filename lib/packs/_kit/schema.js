// A small JSON Schema checker for the subset the harness contract allows (section 4b): type,
// properties, required, additionalProperties, items, enum, const, anyOf, minimum, maximum, minLength,
// maxLength, minItems, maxItems, pattern, format (uri, email, date, textarea, asset), title,
// description, default; on workflow inputs also accept (file inputs) and options: 'pipeline'.
// Used by kit/ai.js to accept or reject an AI answer, and by dev/engine.js to validate tool inputs
// the way the harness will.

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}

function typeOk(want, v) {
  const have = typeOf(v);
  const wants = Array.isArray(want) ? want : [want];
  return wants.some((w) => w === have || (w === 'number' && have === 'integer'));
}

// Returns a list of "path: problem" strings; empty means valid.
function check(schema, value, path = '$') {
  const errs = [];
  if (!schema || typeof schema !== 'object') return errs;
  if (Array.isArray(schema.anyOf)) {
    if (schema.anyOf.some((option) => !check(option, value, path).length)) return errs;
    errs.push(`${path}: matches none of its forms`);
    return errs;
  }
  if (schema.type && !typeOk(schema.type, value)) {
    errs.push(`${path}: expected ${[].concat(schema.type).join('|')}, got ${typeOf(value)}`);
    return errs;
  }
  if (schema.enum && !schema.enum.some((e) => e === value)) errs.push(`${path}: not one of ${schema.enum.join(', ')}`);
  if (schema.const !== undefined && JSON.stringify(schema.const) !== JSON.stringify(value)) errs.push(`${path}: should be ${JSON.stringify(schema.const)}`);
  if (typeof value === 'number') {
    if (schema.minimum != null && value < schema.minimum) errs.push(`${path}: below ${schema.minimum}`);
    if (schema.maximum != null && value > schema.maximum) errs.push(`${path}: above ${schema.maximum}`);
  }
  if (typeof value === 'string') {
    if (schema.maxLength != null && value.length > schema.maxLength) errs.push(`${path}: longer than ${schema.maxLength}`);
    if (schema.minLength != null && value.length < schema.minLength) errs.push(`${path}: shorter than ${schema.minLength}`);
    if (schema.pattern) {
      let re = null;
      try {
        re = new RegExp(schema.pattern);
      } catch {
        re = null;
      }
      if (re && !re.test(value)) errs.push(`${path}: not in the right format`);
    }
  }
  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) errs.push(`${path}: fewer than ${schema.minItems} items`);
    if (schema.maxItems != null && value.length > schema.maxItems) errs.push(`${path}: more than ${schema.maxItems} items`);
    if (schema.items) value.forEach((x, i) => errs.push(...check(schema.items, x, `${path}[${i}]`)));
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const k of schema.required || []) if (value[k] === undefined) errs.push(`${path}.${k}: required`);
    for (const [k, sub] of Object.entries(schema.properties || {})) {
      if (value[k] !== undefined && value[k] !== null) errs.push(...check(sub, value[k], `${path}.${k}`));
    }
  }
  return errs;
}

// Fills defaults (deeply, for object properties) and coerces simple strings from forms
// ("12" -> 12 for integer fields, "true" -> true). Returns a new value; does not validate.
function withDefaults(schema, value) {
  if (!schema || typeof schema !== 'object') return value;
  let v = value;
  if (v === undefined && schema.default !== undefined) v = JSON.parse(JSON.stringify(schema.default));
  const t = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  if (typeof v === 'string' && (t === 'integer' || t === 'number') && v.trim() !== '' && Number.isFinite(Number(v))) v = Number(v);
  if (typeof v === 'string' && t === 'boolean' && /^(true|false)$/i.test(v)) v = /^true$/i.test(v);
  if (t === 'object' && (v === undefined || v === null) && schema.properties && Object.values(schema.properties).some((p) => p.default !== undefined)) v = {};
  if (v && typeof v === 'object' && !Array.isArray(v) && schema.properties) {
    const out = { ...v };
    for (const [k, sub] of Object.entries(schema.properties)) {
      const filled = withDefaults(sub, out[k]);
      if (filled !== undefined) out[k] = filled;
    }
    return out;
  }
  if (Array.isArray(v) && schema.items) return v.map((x) => withDefaults(schema.items, x));
  return v;
}

const ALLOWED_KEYWORDS = new Set(['type', 'properties', 'required', 'additionalProperties', 'items', 'enum', 'const', 'anyOf', 'minimum', 'maximum', 'minLength', 'maxLength', 'minItems', 'maxItems', 'pattern', 'format', 'accept', 'options', 'title', 'description', 'default']);
const FORMATS = new Set(['uri', 'email', 'date', 'textarea', 'asset']);

// Keywords outside the contract's subset (dev/lint.js reports these for tool and workflow schemas),
// plus formats and options the contract doesn't name.
function unknownKeywords(schema, path = '$', out = []) {
  if (!schema || typeof schema !== 'object') return out;
  for (const k of Object.keys(schema)) if (!ALLOWED_KEYWORDS.has(k)) out.push(`${path}.${k}`);
  if (schema.format !== undefined && !FORMATS.has(schema.format)) out.push(`${path}.format: ${schema.format}`);
  if (schema.options !== undefined && schema.options !== 'pipeline') out.push(`${path}.options: ${schema.options}`);
  for (const [k, sub] of Object.entries(schema.properties || {})) unknownKeywords(sub, `${path}.properties.${k}`, out);
  if (schema.items) unknownKeywords(schema.items, `${path}.items`, out);
  (Array.isArray(schema.anyOf) ? schema.anyOf : []).forEach((sub, i) => unknownKeywords(sub, `${path}.anyOf[${i}]`, out));
  return out;
}

module.exports = { check, withDefaults, typeOf, unknownKeywords, ALLOWED_KEYWORDS };
