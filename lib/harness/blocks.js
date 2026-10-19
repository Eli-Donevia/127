// Views: how HQ shows a tool's output. A tool's view(output) returns blocks; this file checks them,
// and turns them into plain text for Claude, ChatGPT and the Monday email.
// Blocks: metric, text, table, cards, video, image, file, copy, link (contract section 10).

const { plain, clip, scrubKeys } = require('./text');

const TYPES = new Set(['metric', 'text', 'table', 'cards', 'video', 'image', 'file', 'copy', 'link']);
const FORMATS = new Set(['number', 'money', 'percent', 'link', 'text']);

const safeHref = (h) => {
  const s = String(h || '').trim();
  if (/^\/app\/hq\//.test(s)) return s;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
};
const asset = (a) => (a && typeof a === 'object' && /^\/app\/hq\/files\/[\w-]+$/.test(String(a.url || '')) ? { id: String(a.id), url: a.url, name: clip(a.name, 100), type: String(a.type || ''), bytes: Number(a.bytes) || 0 } : null);
const cell = (v) => (v === null || v === undefined ? '' : typeof v === 'number' || typeof v === 'boolean' ? v : clip(typeof v === 'string' ? v : JSON.stringify(v), 300));

function cleanOne(b) {
  if (!b || typeof b !== 'object' || !TYPES.has(b.type)) return null;
  switch (b.type) {
    case 'metric':
      return { type: 'metric', label: clip(b.label, 60), value: typeof b.value === 'number' ? b.value : clip(b.value, 40), note: b.note ? clip(b.note, 160) : '', format: FORMATS.has(b.format) ? b.format : undefined };
    case 'text':
      return { type: 'text', text: plain(String(b.text || '')).slice(0, 4000) };
    case 'table': {
      const columns = (Array.isArray(b.columns) ? b.columns : []).slice(0, 12).map((c) => ({ key: String(c.key), label: clip(c.label || c.key, 40), format: FORMATS.has(c.format) ? c.format : 'text' }));
      const rows = (Array.isArray(b.rows) ? b.rows : []).slice(0, 500).map((r) => {
        const out = {};
        for (const c of columns) {
          const v = r ? r[c.key] : '';
          out[c.key] = c.format === 'link' ? safeHref(v) || '' : cell(v);
        }
        return out;
      });
      return { type: 'table', title: b.title ? clip(b.title, 80) : '', columns, rows, limit: Math.max(1, Math.min(Number(b.limit) || 10, 500)) };
    }
    case 'cards':
      return {
        type: 'cards',
        title: b.title ? clip(b.title, 80) : '',
        items: (Array.isArray(b.items) ? b.items : []).slice(0, 50).map((i) => ({
          title: clip(i && i.title, 100),
          subtitle: i && i.subtitle ? clip(i.subtitle, 140) : '',
          body: i && i.body ? plain(i.body).slice(0, 1200) : '',
          image: asset(i && i.image),
          badge: i && i.badge ? clip(i.badge, 30) : '',
          href: i && i.href ? safeHref(i.href) : null,
        })),
      };
    case 'video':
    case 'image':
    case 'file': {
      const a = asset(b.asset);
      return a ? { type: b.type, asset: a, caption: b.caption ? clip(b.caption, 200) : '', label: b.label ? clip(b.label, 80) : a.name } : null;
    }
    case 'copy': {
      const email = b.email && typeof b.email === 'object' ? { to: clip(b.email.to, 200), subject: clip(b.email.subject, 200) } : null;
      return { type: 'copy', label: clip(b.label || 'Draft', 80), text: String(b.text || '').replace(/\r\n/g, '\n').slice(0, 6000), email };
    }
    case 'link': {
      const href = safeHref(b.href);
      return href ? { type: 'link', label: clip(b.label || href, 80), href } : null;
    }
    default:
      return null;
  }
}

function clean(blocks) {
  return (Array.isArray(blocks) ? blocks : [blocks]).map(cleanOne).filter(Boolean).slice(0, 30);
}

// When a tool has no view: a short, readable summary of the output.
function fallback(output) {
  if (output === null || output === undefined) return [];
  if (typeof output !== 'object') return [{ type: 'text', text: clip(String(output), 600) }];
  const parts = [];
  for (const [k, v] of Object.entries(output)) {
    if (k === 'sample') continue;
    if (Array.isArray(v)) parts.push(`${v.length} ${k}`);
    else if (typeof v === 'number' || typeof v === 'boolean') parts.push(`${k}: ${v}`);
    else if (typeof v === 'string' && v.length < 120) parts.push(`${k}: ${v}`);
  }
  return parts.length ? [{ type: 'text', text: parts.slice(0, 8).join(', ') }] : [];
}

function view(tool, output) {
  if (output && output.error && Object.keys(output).length === 1) return [{ type: 'text', text: `Didn't work: ${clip(output.error, 300)}` }];
  if (tool && typeof tool.view === 'function') {
    try {
      return clean(tool.view(output));
    } catch (err) {
      console.warn(`[harness] view of ${tool.name} failed: ${scrubKeys(err.message)}`);
    }
  }
  return fallback(output);
}

const fmt = (v, f) => {
  if (typeof v !== 'number') return String(v);
  if (f === 'money') return `$${v.toLocaleString('en-US', { maximumFractionDigits: v % 1 ? 2 : 0 })}`;
  if (f === 'percent') return `${Math.round(v * 1000) / 10}%`;
  return v.toLocaleString('en-US');
};

// Plain text for Claude, ChatGPT and email. base: the site's address, for file links.
function toText(blocks, { base = '', rows = 10 } = {}) {
  const out = [];
  for (const b of blocks || []) {
    if (b.type === 'metric') out.push(`${b.label}: ${fmt(b.value, b.format)}${b.note ? ` (${b.note})` : ''}`);
    else if (b.type === 'text') out.push(b.text);
    else if (b.type === 'table') {
      if (b.title) out.push(b.title);
      for (const r of b.rows.slice(0, rows)) out.push(`- ${b.columns.map((c) => fmt(r[c.key], c.format)).filter((x) => x !== '').join(' | ')}`);
      if (b.rows.length > rows) out.push(`(${b.rows.length - rows} more in HQ)`);
    } else if (b.type === 'cards') {
      if (b.title) out.push(b.title);
      for (const i of b.items) out.push(`- ${i.title}${i.subtitle ? `: ${i.subtitle}` : ''}${i.body ? `\n  ${i.body.replace(/\n/g, '\n  ')}` : ''}`);
    } else if (b.type === 'copy') out.push(`${b.label}:\n${b.text}`);
    else if (b.type === 'link') out.push(`${b.label}: ${b.href}`);
    else if (b.asset) out.push(`${b.caption || b.label}: ${base}${b.asset.url}`);
  }
  return out.join('\n\n');
}

module.exports = { clean, view, fallback, toText, safeHref, TYPES };
