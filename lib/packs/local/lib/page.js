// Print-ready pages: each SVG drawing goes inline into static HTML sized in inches (@page), with
// print notes that show on screen only. No scripts. PNG previews at 2x when the run can render.

const kit = require('../../_kit');
const { files, save, media, text } = kit;

const FONT_LINK = '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">';

function inches(px) {
  return `${Math.round((px / 96) * 1000) / 1000}in`;
}

// pages: [{ svg, w, h }] in px at 96 per inch. notes: plain lines shown above the pages on screen.
function printHtml({ title, pages, notes = [], description = '' }) {
  const first = pages[0];
  const css = `@page{size:${inches(first.w)} ${inches(first.h)};margin:0}
*{box-sizing:border-box}
html,body{margin:0;background:#e8eaee;color:#16181d;font-family:Inter,'Helvetica Neue',Arial,sans-serif}
.notes{max-width:${inches(first.w)};margin:28px auto 8px;padding:20px 24px;background:#fff;border-radius:14px;font-size:15px;line-height:1.5}
.notes h1{font-size:22px;margin:0 0 8px;letter-spacing:-0.01em}
.notes ul{margin:8px 0 0;padding-left:20px}
.sheet{width:${inches(first.w)};height:${inches(first.h)};margin:20px auto;background:#fff;box-shadow:0 6px 30px rgba(0,0,0,.18);overflow:hidden;break-after:page;page-break-after:always}
.sheet svg{display:block;width:100%;height:100%}
@media print{html,body{background:none}.notes{display:none}.sheet{margin:0;box-shadow:none}}`;
  const list = notes.filter(Boolean).map((n) => `<li>${files.esc(text.plain(n))}</li>`).join('');
  const body = `<section class="notes"><h1>${files.esc(text.plain(title))}</h1>${list ? `<ul>${list}</ul>` : ''}</section>\n${pages.map((p) => `<div class="sheet">${p.svg}</div>`).join('\n')}`;
  return files.htmlDoc({ title: text.plain(title), css, body, head: FONT_LINK, description });
}

async function png(ctx, page, scale = 2) {
  if (!media.canRender(ctx)) return null;
  try {
    const buf = await media.svgToPng(ctx, page.svg, { width: Math.round(page.w * scale), height: Math.round(page.h * scale) });
    return buf;
  } catch {
    return null;
  }
}

// Saves the HTML (and a PNG of each page listed in previews) and returns the saved assets.
async function savePrintable(ctx, { base, title, pages, notes, previews = [0], description }) {
  const html = printHtml({ title, pages, notes, description });
  const out = { html: await save.saveFile(ctx, `${base}.html`, html, 'text/html'), png: [] };
  for (const i of previews) {
    const page = pages[i];
    if (!page) continue;
    const buf = await png(ctx, page);
    if (buf) out.png.push(await save.saveFile(ctx, `${base}${previews.length > 1 ? `-${i + 1}` : ''}.png`, buf, 'image/png'));
  }
  return out;
}

module.exports = { printHtml, savePrintable, png, inches, FONT_LINK };
