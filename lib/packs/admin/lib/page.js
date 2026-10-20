// One printable page style for the admin pack's files (no scripts, prints on letter paper).

const { files } = require('../../_kit');

const { esc } = files;

const CSS = `@page{size:letter;margin:14mm}
*{box-sizing:border-box}
body{font:15px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:#111;background:#fff;max-width:780px;margin:0 auto;padding:22px 16px}
.kicker{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#666;margin:0}
h1{font-size:26px;letter-spacing:-.02em;margin:4px 0 6px}
h2{font-size:17px;margin:26px 0 8px}
h3{font-size:15px;margin:16px 0 4px}
.lede{color:#444;margin:0 0 14px}
.card{border:1px solid #ddd;border-radius:12px;padding:12px 14px;margin:8px 0;break-inside:avoid}
.muted{color:#666;font-size:13px}
.tag{display:inline-block;border:1px solid #bbb;border-radius:999px;padding:1px 9px;font-size:12px;margin-right:6px}
.warn{border-left:4px solid #b45309;padding-left:10px}
.ok{color:#166534}
.miss{color:#9a3412}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{text-align:left;border-bottom:1px solid #e5e5e5;padding:6px 8px;vertical-align:top}
th{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#555}
pre{white-space:pre-wrap;font:14px/1.5 ui-sans-serif,system-ui,sans-serif;margin:0}
ul,ol{padding-left:20px}
li{margin:4px 0}
.box{display:inline-block;width:14px;height:14px;border:1.5px solid #333;border-radius:3px;margin-right:8px;vertical-align:-2px}
.line{display:inline-block;width:180px;border-bottom:1px solid #333;height:1em}
.line.short{width:90px}
footer{margin-top:28px;color:#666;font-size:12px}`;

function page({ title, kicker = '', lede = '', body = '', footer = '' }) {
  return files.htmlDoc({
    title,
    css: CSS,
    description: lede || title,
    body: `${kicker ? `<p class="kicker">${esc(kicker)}</p>` : ''}<h1>${esc(title)}</h1>${lede ? `<p class="lede">${esc(lede)}</p>` : ''}${body}${footer ? `<footer>${esc(footer)}</footer>` : ''}`,
  });
}

const DRAFT_NOTE = 'Drafts only. Nothing here was sent. Copy what you want into your own email.';

module.exports = { page, esc, CSS, DRAFT_NOTE };
