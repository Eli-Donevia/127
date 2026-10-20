// Turns what a member types into a starter's options: form questions into fields, "item, count,
// low at" lines into stock items, names into a team, steps and to-dos into lists.

const { text } = require('../../_kit');

const lines = (s, max = 40) => String(s || '').split(/\r?\n|;/).map((x) => text.oneLine(x.replace(/^[\s\-*\u2022\d.)]+(?=\S)/, ''))).filter(Boolean).slice(0, max);
const list = (s, max = 40) => (Array.isArray(s) ? s.map((x) => text.oneLine(x)).filter(Boolean).slice(0, max) : lines(String(s || '').replace(/,(?![^(]*\))/g, '\n'), max));

const TYPE_HINTS = [
  [/\b(e-?mail)\b/i, 'email'],
  [/\b(phone|cell|mobile|text me|number to text)\b/i, 'tel'],
  [/\b(date|birthday|when is|which day|start day|move[- ]in)\b/i, 'date'],
  [/\b(time of day|what time|arrival time)\b/i, 'time'],
  [/\b(how many|number of|quantity|qty|age of (?:the )?(?:car|home|roof)|square feet|sq ?ft|budget|amount)\b/i, 'number'],
  [/\b(notes?|describe|tell us|details|anything else|comments?|message|address|explain)\b/i, 'textarea'],
];

// "Email *" | "Service: Standard, Deep, Move-out" | "Any pets? (yes/no)" | "Notes (long)"
function parseFields(questions, { max = 30 } = {}) {
  const out = [];
  const used = new Set();
  for (const raw of lines(questions, max)) {
    let label = raw;
    let required = false;
    if (/\*\s*$|\(required\)\s*$/i.test(label)) {
      required = true;
      label = label.replace(/\s*(\*|\(required\))\s*$/i, '');
    }
    let type = '';
    let options;
    const hint = label.match(/\((long|yes\/no|yes or no|checkbox|date|time|number|email|phone)\)\s*$/i);
    if (hint) {
      const h = hint[1].toLowerCase();
      type = h === 'long' ? 'textarea' : /yes|checkbox/.test(h) ? 'checkbox' : h === 'phone' ? 'tel' : h;
      label = label.slice(0, hint.index).trim();
    }
    const pick = label.match(/^([^:]{2,80}):\s*(.+,.+)$/);
    if (!type && pick) {
      label = pick[1].trim();
      options = pick[2].split(/\s*,\s*|\s*\/\s*/).map((x) => text.clip(x, 60)).filter(Boolean).slice(0, 20);
      type = 'select';
    }
    if (!type) type = (TYPE_HINTS.find(([re]) => re.test(label)) || [null, 'text'])[1];
    label = text.clip(label.replace(/:\s*$/, ''), 80);
    if (!label) continue;
    let id = text.slug(label, 24).replace(/-/g, '_') || `q${out.length + 1}`;
    if (!/^[a-z]/.test(id)) id = `q_${id}`;
    while (used.has(id)) id = `${id}_2`;
    used.add(id);
    out.push({ id, label, type, required, ...(options ? { options } : {}) });
  }
  return out;
}

// "Paper towels, 12, 4" or "Paper towels: 12 (low 4) rolls"
function parseStock(s, max = 100) {
  return lines(s, max)
    .map((l) => {
      const nums = (l.match(/\d+(?:\.\d+)?/g) || []).map(Number);
      const name = text.clip(l.replace(/[,:(].*$/, '').replace(/\s+\d.*$/, ''), 60);
      if (!name) return null;
      const unit = (l.match(/\d\s*([a-z]{3,12})\s*$/i) || [])[1] || '';
      return { name, count: nums[0] || 0, low: nums[1] != null ? nums[1] : 2, unit: /^low$/i.test(unit) ? '' : unit };
    })
    .filter(Boolean);
}

// "Shop, Ask a question | https://..." or "Pay: https://..."
function parseLinks(s, max = 8) {
  return lines(s, max)
    .map((l) => {
      const m = l.match(/(https:\/\/\S+|mailto:\S+|tel:\S+|sms:\S+)/i);
      if (!m) return null;
      const label = text.clip(l.replace(m[0], '').replace(/[|:,\s]+$/g, '').replace(/^[|:,\s]+/, ''), 40) || 'Open link';
      return { label, href: m[0].replace(/[),.]+$/, '') };
    })
    .filter(Boolean);
}

// "Q? A" pairs: "How do I pay? By card or Venmo."
function parseFaq(s, max = 10) {
  return lines(s, max)
    .map((l) => {
      const i = l.indexOf('?');
      return i > 3 ? [l.slice(0, i + 1), text.oneLine(l.slice(i + 1)) || 'Ask us and we will tell you.'] : null;
    })
    .filter(Boolean);
}

// The options a starter takes, from the tool's input.
function starterOptions(id, input = {}) {
  const o = {};
  if (input.title) o.title = text.clip(input.title, 60);
  if (input.tax != null) o.tax = Number(input.tax) || 0;
  if (input.deposit != null) o.deposit = Number(input.deposit) || 0;
  if (input.hours) o.hours = text.clip(input.hours, 120);
  if (id === 'form' && input.questions) o.fields = parseFields(input.questions);
  if (id === 'intake' && input.questions) o.sections = [['Checklist', lines(input.questions, 30)]];
  if (id === 'stock' && input.questions) o.items = parseStock(input.questions);
  if (id === 'tips' && (input.staff || input.questions)) o.staff = list(input.staff || input.questions, 40);
  if (id === 'portal') {
    if (input.client) o.client = input.client;
    if (input.steps) o.steps = list(input.steps, 10);
    if (input.stage != null) o.stage = input.stage;
    if (input.next) o.next = input.next;
    if (input.todos) o.todos = lines(input.todos, 12);
    if (input.links) o.links = parseLinks(input.links);
    if (input.payLink) o.payLink = input.payLink;
    if (input.questions) o.faq = parseFaq(input.questions);
  }
  return o;
}

module.exports = { parseFields, parseStock, parseLinks, parseFaq, starterOptions, lines, list };
