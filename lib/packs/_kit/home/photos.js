// Photos the member adds (a before and an after): read from their Library (ctx.asset), turned upright
// from the phone's EXIF orientation, then scaled and cropped to a panel and returned as JPEG bytes
// ready to embed in an SVG (kit svg.image) for media.svgToPng. Needs ffmpeg (wants: ['render']).
// Shared household spine.

const fs = require('fs');
const path = require('path');
const { media } = require('..');

const OK_TYPE = /^image\/(jpe?g|png|webp|gif|heic|heif)$/i;
const OK_NAME = /\.(jpe?g|png|webp|gif|heic|heif)$/i;

// EXIF orientation (1 to 8) from a JPEG's APP1 segment, or 1.
function exifOrientation(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return 1;
  let i = 2;
  while (i + 4 < buf.length && buf[i] === 0xff) {
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker === 0xda || len < 2) break; // start of scan: no more headers
    if (marker === 0xe1 && buf.toString('binary', i + 4, i + 10) === 'Exif\0\0') {
      const t = i + 10;
      const le = buf.toString('binary', t, t + 2) === 'II';
      const u16 = (o) => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
      const u32 = (o) => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
      try {
        const ifd = t + u32(t + 4);
        const n = u16(ifd);
        for (let k = 0; k < n; k++) {
          const e = ifd + 2 + k * 12;
          if (u16(e) === 0x0112) {
            const v = u16(e + 8);
            return v >= 1 && v <= 8 ? v : 1;
          }
        }
      } catch {
        return 1;
      }
      return 1;
    }
    i += 2 + len;
  }
  return 1;
}

// The ffmpeg filter that turns a photo upright for an EXIF orientation.
const UPRIGHT = { 1: '', 2: 'hflip', 3: 'hflip,vflip', 4: 'vflip', 5: 'transpose=0', 6: 'transpose=1', 7: 'transpose=3', 8: 'transpose=2' };

// One Library photo as an upright JPEG panel of w x h (cropped to fill). Returns { data, type, name }.
async function panel(ctx, id, { w = 540, h = 675, label = 'photo' } = {}) {
  if (!id) return null;
  if (!ctx || typeof ctx.asset !== 'function') throw new Error(`Couldn't open the ${label}. Add it again from your Library.`);
  const a = await ctx.asset(id);
  if (!a || !a.path) throw new Error(`Couldn't open the ${label}. Add it again from your Library.`);
  if (!(OK_TYPE.test(String(a.type || '')) || OK_NAME.test(String(a.name || '')))) throw new Error(`The ${label} needs to be a photo (JPG, PNG or WebP).`);
  if (!media.hasFfmpeg()) throw new Error("Photos can't be processed right now. Try again in a minute.");
  let head = Buffer.alloc(0);
  try {
    const fd = fs.openSync(a.path, 'r');
    head = Buffer.alloc(Math.min(256 * 1024, fs.fstatSync(fd).size));
    fs.readSync(fd, head, 0, head.length, 0);
    fs.closeSync(fd);
  } catch {
    /* no EXIF to read: keep it as stored */
  }
  const turn = UPRIGHT[exifOrientation(head)] || '';
  const dir = media.scratch(ctx, 'photo');
  const out = path.join(dir, 'panel.jpg');
  const vf = [turn, `scale=${w}:${h}:force_original_aspect_ratio=increase`, `crop=${w}:${h}`, 'setsar=1'].filter(Boolean).join(',');
  try {
    await media.ffmpeg(['-noautorotate', '-i', a.path, '-frames:v', '1', '-vf', vf, '-q:v', '3', out], { timeoutSec: 60, signal: ctx.signal });
  } catch {
    if (/\.(heic|heif)$/i.test(String(a.name || '')) || /heic|heif/i.test(String(a.type || ''))) {
      throw new Error(`The ${label} is in the iPhone HEIC format. Share it as a JPG (or set Camera, Formats to Most Compatible) and add it again.`);
    }
    throw new Error(`Couldn't read the ${label}. Try a JPG or PNG.`);
  }
  return { data: fs.readFileSync(out), type: 'image/jpeg', name: a.name || label };
}

module.exports = { panel, exifOrientation, UPRIGHT };
