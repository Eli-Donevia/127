// Turning an app into the member's files, and reading one back.
// - The app ships as a ZIP holding index.html (the working app) and _headers (the same no-outside-
//   requests policy for Netlify and Cloudflare Pages). Open index.html in any browser to use it, or
//   drag the ZIP onto Netlify Drop to put it online.
// - A preview copy with the scripts taken out, so HQ (which shows HTML with scripts off) shows the
//   real layout, with a line saying how to open the working app.

const fs = require('fs');
const path = require('path');
const { files, save, text } = require('../../_kit');
const { CSP } = require('./shell');

const HEADERS = (listed) => `/*\n  Content-Security-Policy: ${CSP}; frame-ancestors 'none'\n  Referrer-Policy: no-referrer\n  X-Content-Type-Options: nosniff\n${listed ? '' : '  X-Robots-Tag: noindex\n'}`;

const README = (title) => `${title}

How to use it
1. Unzip this file.
2. Open index.html in Chrome, Safari, Edge or Firefox, on your phone or computer. It works with no internet.
3. On a phone, use Share then Add to Home Screen so it opens like an app.

What it saves
Anything you type is saved in that browser on that device only. Another phone or browser starts empty.
Clearing your browser data clears it too, so download the CSV now and then if the app has one.

Put it online (optional)
Drag the ZIP onto app.netlify.com/drop. The _headers file keeps the same rules online: no outside
requests, and search engines are asked not to list it. Don't put private client details in an app
that anyone with the link can open.
`;

function preview(html, { title } = {}) {
  const banner = `<div style="position:sticky;top:0;z-index:9;background:#fafafa;color:#0a0a0a;padding:10px 16px;font:14px/1.4 system-ui,sans-serif;text-align:center">Preview of ${files.esc(title || 'your app')}. Download the ZIP and open index.html to use it.</div>`;
  return String(html)
    .replace(/<script\b(?![^>]*application\/ld\+json)[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/<body([^>]*)>/i, (m) => `${m}\n${banner}`);
}

// Saves the app ZIP and its preview. Returns { zip, preview }.
async function saveApp(ctx, html, { business, title, listed = false }) {
  const name = save.fileName(business || 'my', text.slug(title, 40) || 'app');
  const zipBuf = files.zip(
    [
      { name: 'index.html', data: html },
      { name: '_headers', data: HEADERS(listed) },
      { name: 'README.txt', data: README(title) },
    ],
    { mtime: typeof ctx.now === 'function' ? ctx.now() : Date.now() }
  );
  const zip = await save.saveFile(ctx, `${name}.zip`, zipBuf);
  const prev = await save.saveFile(ctx, `${name}-preview.html`, preview(html, { title }));
  return { zip, preview: prev };
}

const MAX_IN = 2 * 1024 * 1024;

// Reads an app the member uploads: an .html file, or a ZIP with index.html (or one .html) inside.
async function readApp(ctx, id) {
  const a = await ctx.asset(id);
  if (a.bytes > MAX_IN) throw new Error('That file is over 2 MB. Upload just the app\'s .html file.');
  const buf = fs.readFileSync(a.path);
  const name = String(a.name || path.basename(a.path));
  if (/\.zip$/i.test(name) || (buf[0] === 0x50 && buf[1] === 0x4b)) {
    let entries = [];
    try {
      entries = files.unzip(buf);
    } catch {
      entries = [];
    }
    const html = entries.find((e) => /(^|\/)index\.html?$/i.test(e.name)) || entries.find((e) => /\.html?$/i.test(e.name));
    if (!html) throw new Error("That ZIP doesn't open here. Unzip it and upload the index.html file inside.");
    return { html: html.data.toString('utf8'), name: html.name, from: name };
  }
  const t = buf.toString('utf8').replace(/^\ufeff/, '');
  if (!/<html[\s>]|<!doctype html/i.test(t)) throw new Error("That file isn't an HTML app. Upload the .html file (or the ZIP) your app came in.");
  return { html: t, name, from: name };
}

// The settings our apps carry (null for apps from elsewhere).
function configOf(html) {
  const m = String(html).match(/<script\b[^>]*id\s*=\s*["']app-config["'][^>]*>([\s\S]*?)<\/script\s*>/i);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

function titleOf(html) {
  const m = String(html).match(/<title>([\s\S]*?)<\/title>/i);
  return m ? text.oneLine(m[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').split(' | ')[0]) : 'Your app';
}

module.exports = { saveApp, readApp, preview, configOf, titleOf, HEADERS, README };
