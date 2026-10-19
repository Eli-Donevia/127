// Library files a tool was handed: a file input's id ("a1b2c3"), or a file an earlier step saved
// ({ id, url, name, type, bytes }). Read only through ctx.asset, never from a path in the input.

function idOf(v) {
  if (typeof v === 'string') return v.trim() || null;
  if (v && typeof v === 'object' && !Array.isArray(v) && (typeof v.id === 'string' || typeof v.id === 'number')) return String(v.id);
  return null;
}

// { id, name, type, bytes, path } or null when there is no file or this ctx can't read files.
async function assetFile(ctx, v) {
  const id = idOf(v);
  if (!id || !ctx || typeof ctx.asset !== 'function') return null;
  const a = await ctx.asset(id);
  return a && a.path ? a : null;
}

const isImage = (a) => /^image\//.test((a && a.type) || '') || /\.(jpe?g|png|webp|gif)$/i.test((a && a.name) || '');
const isVideo = (a) => /^video\//.test((a && a.type) || '') || /\.(mp4|mov|m4v|webm)$/i.test((a && a.name) || '');
const isAudio = (a) => /^audio\//.test((a && a.type) || '') || /\.(mp3|wav|m4a|aac|ogg)$/i.test((a && a.name) || '');

module.exports = { idOf, assetFile, isImage, isVideo, isAudio };
