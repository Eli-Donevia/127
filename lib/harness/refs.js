// References inside a workflow's step inputs. A string that is exactly a reference is replaced by
// its value: '$inputs.city', '$gyms' (a step's whole output), '$gyms.gyms.0', '$item' and '$index'
// inside an `each` step, '$videos.$index', '$brain.business.city', '$member.firstName'.
// '$$' starts a literal string ('$$5 off' is '$5 off'). Any other string, number or object is a
// plain value; arrays and objects are walked, so references can sit anywhere inside them.

const REF = /^\$[A-Za-z_]\w*(?:\.(?:\$index|[\w-]+))*$/;
const RESERVED = new Set(['inputs', 'item', 'index', 'brain', 'member']);
const MEMBER_FIELDS = new Set(['id', 'firstName', 'tier', 'timezone']);

function isRef(v) {
  return typeof v === 'string' && REF.test(v);
}

function parse(ref) {
  const [root, ...path] = ref.slice(1).split('.');
  return { root, path };
}

function dig(value, path, scope) {
  let v = value;
  for (const raw of path) {
    if (v === undefined || v === null) return undefined;
    const seg = raw === '$index' ? scope.index : raw;
    if (Array.isArray(v)) {
      const n = Number(seg);
      if (!Number.isInteger(n)) return undefined;
      v = v[n];
    } else if (typeof v === 'object') {
      if (!Object.prototype.hasOwnProperty.call(v, seg)) return undefined;
      v = v[seg];
    } else return undefined;
  }
  return v;
}

// scope: { inputs, steps: { [id]: output }, item, index, brain, member }
function lookup(ref, scope) {
  const { root, path } = parse(ref);
  if (root === 'inputs') return dig(scope.inputs, path, scope);
  if (root === 'item') return dig(scope.item, path, scope);
  if (root === 'index') return path.length ? undefined : scope.index;
  if (root === 'brain') return dig(scope.brain, path, scope);
  if (root === 'member') {
    if (path.length !== 1 || !MEMBER_FIELDS.has(path[0])) return undefined;
    return scope.member ? scope.member[path[0]] : undefined;
  }
  const steps = scope.steps || {};
  if (!Object.prototype.hasOwnProperty.call(steps, root)) return undefined;
  return dig(steps[root], path, scope);
}

function resolve(tpl, scope) {
  if (typeof tpl === 'string') {
    if (tpl.startsWith('$$')) return tpl.slice(1);
    return isRef(tpl) ? lookup(tpl, scope) : tpl;
  }
  if (Array.isArray(tpl)) return tpl.map((t) => resolve(t, scope));
  if (tpl && typeof tpl === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(tpl)) {
      const r = resolve(v, scope);
      if (r !== undefined) out[k] = r;
    }
    return out;
  }
  return tpl;
}

// Every reference inside a template: [{ ref, root, path }]. The pack loader uses it to check that
// a step only reads steps that come before it.
function list(tpl, out = []) {
  if (typeof tpl === 'string') {
    if (!tpl.startsWith('$$') && isRef(tpl)) out.push({ ref: tpl, ...parse(tpl) });
  } else if (Array.isArray(tpl)) tpl.forEach((t) => list(t, out));
  else if (tpl && typeof tpl === 'object') Object.values(tpl).forEach((t) => list(t, out));
  return out;
}

// A string that starts with '$' but isn't a reference is almost always a typo ('$gyms gyms').
function suspicious(tpl, out = []) {
  if (typeof tpl === 'string') {
    if (tpl.startsWith('$') && !tpl.startsWith('$$') && !isRef(tpl) && /^\$[A-Za-z_]/.test(tpl)) out.push(tpl);
  } else if (Array.isArray(tpl)) tpl.forEach((t) => suspicious(t, out));
  else if (tpl && typeof tpl === 'object') Object.values(tpl).forEach((t) => suspicious(t, out));
  return out;
}

module.exports = { isRef, parse, resolve, lookup, list, suspicious, RESERVED };
