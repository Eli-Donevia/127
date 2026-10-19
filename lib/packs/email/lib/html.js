// The HTML email: table layout, inline styles, 600px, a hidden preheader, a bulletproof button,
// dark mode that keeps contrast, and a footer with the platform's real unsubscribe and address tags.
// Plus a plain-text version. No scripts, no images needed.

const { files, color } = require('../../_kit');
const platforms = require('../data/platforms.json');

const esc = files.esc;
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const GENERIC = { firstName: '', unsubscribe: '[YOUR UNSUBSCRIBE LINK]', address: '[Your mailing address]' };

function platformOf(id) {
  return platforms.list.find((x) => x.id === id) || null;
}

function tagsFor(id) {
  const p = platformOf(id);
  if (!p || !p.tags || !p.tags.unsubscribe) return { ...GENERIC };
  return { firstName: p.tags.firstName || '', unsubscribe: p.tags.unsubscribe, address: p.tags.address || GENERIC.address, preview: p.tags.preview || '' };
}

// Only Kit and Klaviyo have a safe default for an empty first name.
function greeting(body, id) {
  const t = tagsFor(id);
  if (!t.firstName || /FNAME/.test(t.firstName)) return body;
  return body.replace(/^Hi there,/, `Hi ${t.firstName},`);
}

function paragraphs(body, c) {
  return String(body || '')
    .split(/\n{2,}/)
    .map((para) => {
      const lines = para.split('\n').map(esc);
      const q = lines.length > 1 && lines[0].length < 80 && !/[.!]$/.test(lines[0]);
      const html = q ? `<strong style="color:${c.ink};" class="ink">${lines[0]}</strong><br>${lines.slice(1).join('<br>')}` : lines.join('<br>');
      return `<p style="margin:0 0 18px 0;font-family:${FONT};font-size:17px;line-height:1.6;color:${c.ink};" class="ink">${html}</p>`;
    })
    .join('\n');
}

// The button goes right before the sign-off, so it sits under the line that asks for the tap.
function withButton(body, email, facts, c) {
  const paras = String(body || '').split(/\n{2,}/);
  const sign = facts.first ? (facts.hasName === false ? facts.first : `${facts.first}\n${facts.business}`) : facts.hasName === false ? 'Talk soon' : facts.business;
  let at = paras.findIndex((x) => x.trim() === sign);
  if (at < 0) at = paras.length;
  return `${paragraphs(paras.slice(0, at).join('\n\n'), c)}\n${button(email.button, email.link, c)}\n${paragraphs(paras.slice(at).join('\n\n'), c)}`;
}

function button(label, href, c) {
  if (!label || !href) return '';
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 26px 0;"><tr><td align="center" bgcolor="${c.primary}" style="border-radius:999px;background:${c.primary};" class="btn-td"><a href="${esc(href)}" target="_blank" style="display:inline-block;padding:15px 30px;font-family:${FONT};font-size:16px;font-weight:700;line-height:1.2;color:${c.onPrimary};text-decoration:none;border-radius:999px;" class="btn-a">${esc(label)}</a></td></tr></table>`;
}

// email: { subject, preview, body, button, link }; p: palette; facts: business, site; platform id.
// opts.inner replaces the email's own text (Kit's template puts its content tag there).
function emailHtml(email, p, facts, platform, opts = {}) {
  const t = tagsFor(platform);
  const c = {
    paper: '#f4f1ee',
    card: '#ffffff',
    ink: '#1d1b1a',
    muted: '#6b6560',
    primary: color.ensureContrast ? color.ensureContrast(p.primary, '#ffffff', 4.5) : p.primary,
    onPrimary: '#ffffff',
    line: '#e7e2dd',
  };
  const darkPrimary = color.lighten ? color.lighten(p.primary, 0.25) : p.primary;
  const body = greeting(email.body, platform);
  const preview = email.preview || '';
  const unsub = t.unsubscribe.startsWith('[') ? '#' : t.unsubscribe;
  const css = `
:root{color-scheme:light dark;supported-color-schemes:light dark}
body{margin:0;padding:0;width:100%!important;-webkit-text-size-adjust:100%}
a{color:${c.primary}}
@media (max-width:620px){.container{width:100%!important}.pad{padding-left:22px!important;padding-right:22px!important}.h1{font-size:26px!important}}
@media (prefers-color-scheme:dark){
.bg{background:#141312!important}.card{background:#1f1d1b!important;border-color:#2e2b28!important}
.ink{color:#f3efea!important}.muted{color:#b4ada6!important}.rule{border-color:#2e2b28!important}
.btn-td{background:${darkPrimary}!important}.btn-a{color:#141312!important}.brand{color:${darkPrimary}!important}
}
[data-ogsc] .ink{color:#f3efea!important}[data-ogsc] .muted{color:#b4ada6!important}`;
  const spacer = '&#847;&zwnj;&nbsp;'.repeat(60);
  const footerUnsub = t.unsubscribe.startsWith('[') ? `<a href="#" style="color:${c.muted};text-decoration:underline;" class="muted">${esc(t.unsubscribe)}</a>` : `<a href="${unsub}" style="color:${c.muted};text-decoration:underline;" class="muted">Unsubscribe</a>`;
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(email.subject)}</title>
<style>${css}</style>
</head>
<body style="margin:0;padding:0;background:${c.paper};" class="bg">
${opts.inner == null ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${esc(preview)}${spacer}</div>\n` : ''}<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${c.paper};" class="bg">
<tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" class="container" style="width:600px;max-width:600px;">
<tr><td class="pad" style="padding:0 8px 18px 8px;font-family:${FONT};font-size:15px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${c.primary};"><span class="brand">${esc(facts.hasName === false ? facts.site || '' : facts.business)}</span></td></tr>
<tr><td class="card" style="background:${c.card};border:1px solid ${c.line};border-radius:20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
<tr><td style="height:6px;line-height:6px;font-size:0;background:${c.primary};border-radius:20px 20px 0 0;">&nbsp;</td></tr>
<tr><td class="pad" style="padding:40px 44px 18px 44px;">
${opts.inner == null ? withButton(body, email, facts, c) : `<div style="font-family:${FONT};font-size:17px;line-height:1.6;color:${c.ink};" class="ink">${opts.inner}</div>`}
</td></tr>
</table>
</td></tr>
<tr><td class="pad" style="padding:22px 8px 0 8px;font-family:${FONT};font-size:13px;line-height:1.6;color:${c.muted};" class="muted">
<p style="margin:0 0 8px 0;" class="muted">You're getting this because you signed up${facts.site ? ` at ${esc(facts.site)}` : ` with ${esc(facts.business)}`}.</p>
<p style="margin:0 0 8px 0;" class="muted">${esc(facts.business)}, ${esc(t.address)}</p>
<p style="margin:0;" class="muted">${footerUnsub}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`;
}

// Kit's own template: the same design around Kit's {{ message_content }} tag, with its unsubscribe
// and address tags in the footer. Pasted once in Kit, every email written there comes out in it.
function kitTemplate(p, facts) {
  const kit = platformOf('kit');
  return emailHtml({ subject: facts.hasName === false ? 'Email template' : `${facts.business} email template`, preview: '', body: '' }, p, facts, 'kit', { inner: kit.tags.content });
}

// Plain text for pasting into an editor. The tool's own footer adds the unsubscribe link and the
// mailing address, so the text ends at the sign-off and the button link.
function emailText(email, facts, platform) {
  const lines = [greeting(email.body, platform)];
  if (email.button && email.link) lines.push(`${email.button}: ${email.link}`);
  return lines.join('\n\n');
}

const TEXT_NOTE = "Paste each email into your email tool's editor. Keep the tool's footer on: it adds your unsubscribe link and mailing address, which every email needs.";

module.exports = { emailHtml, kitTemplate, emailText, tagsFor, platformOf, greeting, TEXT_NOTE };
