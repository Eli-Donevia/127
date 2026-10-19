// Image cards (the Video Scorecard, the before-and-after card): SVG rendered to PNG by ffmpeg's
// librsvg decoder, with the pack's own fonts so a card looks the same on any server. When ffmpeg
// can't render it, the SVG itself is saved instead.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

// Point fontconfig at the pack's fonts (pack/assets/fonts) when they're there.
function fontEnv(tmp) {
  const dir = path.join(__dirname, '..', 'assets', 'fonts');
  if (!fs.existsSync(dir)) return process.env;
  const conf = path.join(tmp, 'fonts.conf');
  fs.writeFileSync(conf, `<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n<fontconfig><dir>${dir}</dir><include ignore_missing="yes">/etc/fonts/fonts.conf</include><cachedir>${path.join(tmp, 'fc')}</cachedir></fontconfig>\n`);
  return { ...process.env, FONTCONFIG_FILE: conf };
}

function toPng(svgPath, pngPath, env, signal) {
  return new Promise((resolve) => {
    execFile('ffmpeg', ['-y', '-loglevel', 'error', '-i', svgPath, '-frames:v', '1', pngPath], { env, timeout: 30000, signal }, (err) => resolve(!err && fs.existsSync(pngPath)));
  });
}

// Saves `svg` as name.png through ctx.save (or name.svg if it can't be rendered).
// Returns { image, png }.
async function saveCard(ctx, svg, name) {
  const tmp = typeof ctx.tmpdir === 'function' ? ctx.tmpdir() : fs.mkdtempSync(path.join(os.tmpdir(), 'gym-card-'));
  const base = path.basename(name);
  const svgPath = path.join(tmp, `${base}.svg`);
  const pngPath = path.join(tmp, `${base}.png`);
  fs.writeFileSync(svgPath, svg);
  if (await toPng(svgPath, pngPath, fontEnv(tmp), ctx.signal)) return { image: await ctx.save(`${name}.png`, fs.readFileSync(pngPath), { type: 'image/png' }), png: true };
  return { image: await ctx.save(`${name}.svg`, svg, { type: 'image/svg+xml' }), png: false };
}

module.exports = { fontEnv, toPng, saveCard };
