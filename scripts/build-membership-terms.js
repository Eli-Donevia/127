#!/usr/bin/env node
// Builds views/partials/membership-terms.ejs (and circle-agreement.ejs, earnings-disclaimer.ejs, cookie-notice.ejs)
// from Legal's Markdown source.
//
//   node scripts/build-membership-terms.js [path/to/03-membership-billing-terms.md]
//   node scripts/build-membership-terms.js --circle [path/to/04-founders-circle-agreement.md]
//   node scripts/build-membership-terms.js --earnings [path/to/05-earnings-disclaimer.md]   (Part A only)
//   node scripts/build-membership-terms.js --cookies [path/to/08-cookie-notice.md]          (Part A only)
//   node scripts/build-membership-terms.js --terms [path/to/01-terms-of-service.md]
//   node scripts/build-membership-terms.js --privacy [path/to/02-privacy-policy.md]
//
// Only the public page goes in: the title through Section 18. The note above the
// title, the Appendices (implementation specs) and the "Drafting notes" are left out.
// Re-run it whenever Legal updates the source, and commit the generated partial.
// A tiny converter on purpose (headings, paragraphs, lists, tables, bold, links), so
// no Markdown dependency ships with the site.

const fs = require('fs');
const path = require('path');

const ARG = process.argv.slice(2).find((a) => !a.startsWith('--'));
// partA: the document's public page is its "# Part A" (legal/README.md), so the build stops at "# Part B".
const DOCS = {
  circle: { src: '/mnt/project-files/legal/04-founders-circle-agreement.md', out: 'circle-agreement.ejs', name: 'legal/04-founders-circle-agreement.md' },
  earnings: { src: '/mnt/project-files/legal/05-earnings-disclaimer.md', out: 'earnings-disclaimer.ejs', name: 'legal/05-earnings-disclaimer.md (Part A)', partA: true },
  cookies: { src: '/mnt/project-files/legal/08-cookie-notice.md', out: 'cookie-notice.ejs', name: 'legal/08-cookie-notice.md (Part A)', partA: true },
  terms: { src: '/mnt/project-files/legal/01-terms-of-service.md', out: 'terms-of-service.ejs', name: 'legal/01-terms-of-service.md' },
  privacy: { src: '/mnt/project-files/legal/02-privacy-policy.md', out: 'privacy-policy.ejs', name: 'legal/02-privacy-policy.md' },
  membership: { src: '/mnt/project-files/legal/03-membership-billing-terms.md', out: 'membership-terms.ejs', name: 'legal/03-membership-billing-terms.md (title to Section 18)' },
};
const DOC = DOCS[['circle', 'earnings', 'cookies', 'terms', 'privacy'].find((k) => process.argv.includes(`--${k}`)) || 'membership'];
const SRC = ARG || DOC.src;
const OUT = path.join(__dirname, '..', 'views', 'partials', DOC.out);

function escape(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Links are limited to site paths, anchors, https and mailto.
function inline(text) {
  let s = escape(text);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, href) =>
    /^(\/|#|https:\/\/|mailto:)/.test(href) ? `<a href="${href}">${label}</a>` : label
  );
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  return s;
}

function slug(heading) {
  const n = heading.match(/^(\d+(?:\.\d+)?)\.?\s/);
  if (n) return 'section-' + n[1].replace('.', '-');
  return heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// The public page: from the title down to (not including) the first Appendix or
// the drafting notes, whichever comes first.
function publicPart(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((l) => /^# /.test(l));
  if (start < 0) throw new Error('No title (# heading) found in the source.');
  let end = lines.findIndex((l, i) => i > start && (/^# Appendix/i.test(l) || /^#+ Drafting notes/i.test(l)));
  if (end < 0) end = lines.length;
  const body = lines.slice(start, end);
  while (body.length && /^(---|\s*)$/.test(body[body.length - 1])) body.pop();
  return body;
}

function convert(lines) {
  const out = [];
  let i = 0;
  const cells = (row) => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || /^---+$/.test(line.trim())) {
      i++;
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      out.push(`<h${level} id="${slug(h[2])}">${inline(h[2])}</h${level}>`);
      i++;
      continue;
    }
    if (line.trim().startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(lines[i++]);
      const head = cells(rows[0]);
      const bodyRows = rows.slice(1).filter((r) => !/^\s*\|?\s*:?-{3,}/.test(r));
      out.push('<div class="table-wrap"><table class="t">');
      out.push('<thead><tr>' + head.map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead>');
      out.push('<tbody>');
      for (const r of bodyRows) out.push('<tr>' + cells(r).map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>');
      out.push('</tbody></table></div>');
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      out.push('<ul class="bul">');
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) out.push(`<li>${inline(lines[i++].replace(/^[-*]\s+/, ''))}</li>`);
      out.push('</ul>');
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      out.push('<ol>');
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) out.push(`<li>${inline(lines[i++].replace(/^\d+\.\s+/, ''))}</li>`);
      out.push('</ol>');
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|[-*]\s|\d+\.\s|\|)/.test(lines[i])) para.push(lines[i++].trim());
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return out.join('\n');
}

// "# Part A. Cookie Notice (public page at /cookies)" down to "# Part B", titled "Cookie Notice".
function partA(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((l) => /^# Part A\b/i.test(l));
  if (start < 0) throw new Error('No "# Part A" heading found in the source.');
  let end = lines.findIndex((l, i) => i > start && (/^# Part B\b/i.test(l) || /^#+ Drafting notes/i.test(l)));
  if (end < 0) end = lines.length;
  const body = lines.slice(start, end);
  body[0] = '# ' + body[0].replace(/^# Part A\.?\s*/i, '').replace(/\s*\(public page at [^)]*\)\s*$/i, '');
  while (body.length && /^(---|\s*)$/.test(body[body.length - 1])) body.pop();
  return body;
}

function build(md, name = DOC.name, doc = DOC) {
  return (
    `<%# Generated by scripts/build-membership-terms.js from Legal's ${name}. Edit the source and re-run; don't edit by hand. %>\n` +
    `<div class="legal-md">\n${convert(doc.partA ? partA(md) : publicPart(md))}\n</div>\n`
  );
}

if (require.main === module) {
  const html = build(fs.readFileSync(SRC, 'utf8'));
  fs.writeFileSync(OUT, html);
  console.log(`Wrote ${path.relative(process.cwd(), OUT)} (${html.length} bytes) from ${SRC}`);
}

module.exports = { build, inline, publicPart, partA, convert, DOCS };
