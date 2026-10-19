// Saving files to the member's Library through ctx.save (harness contract 7). Returns the asset
// object to put in a tool's output ({ id, url, name, type, bytes }).

const path = require('path');
const { slug } = require('./text');

const TYPES = {
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.csv': 'text/csv',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.ics': 'text/calendar',
  '.srt': 'application/x-subrip',
  '.vtt': 'text/vtt',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.vcf': 'text/vcard',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.zip': 'application/zip',
  '.pdf': 'application/pdf',
  '.liquid': 'text/plain',
  '.xml': 'application/xml',
};

function typeFor(name) {
  return TYPES[path.extname(String(name)).toLowerCase()] || 'application/octet-stream';
}

// "Glow Candle Co" + "website" + ".zip" -> "glow-candle-co-website.zip"
function fileName(...parts) {
  const ext = parts.length && /^\.[a-z0-9]+$/i.test(parts[parts.length - 1]) ? parts.pop() : '';
  return `${parts.map((p) => slug(p, 40)).filter(Boolean).join('-') || 'file'}${ext}`;
}

// Types the harness Library keeps (contract 12; .liquid is saved as plain text and keeps its name).
// Anything else (.css, .js, .xml) is wrapped in a zip so the member still gets it.
const LIBRARY_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'audio/mpeg', 'audio/wav', 'text/csv', 'text/plain', 'text/markdown', 'text/html', 'text/calendar', 'text/vcard', 'text/vtt', 'application/x-subrip', 'application/json', 'application/pdf', 'application/zip']);

async function saveFile(ctx, name, data, type) {
  if (!ctx || typeof ctx.save !== 'function') throw new Error("Couldn't save the file. Try again in a minute.");
  const t = type || typeFor(name);
  try {
    return await ctx.save(name, data, { type: t });
  } catch (e) {
    // The Library refused the type: hand it over zipped, with its real name inside.
    if (!/kind of file|type/i.test(String(e && e.message)) || LIBRARY_TYPES.has(t)) throw e;
    const { zip } = require('./files');
    return ctx.save(`${name}.zip`, zip([{ name: path.basename(name), data }]), { type: 'application/zip' });
  }
}

module.exports = { saveFile, typeFor, fileName, TYPES, LIBRARY_TYPES };
