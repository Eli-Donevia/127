// How to put an app online: checks the app, packs it for drag-and-drop hosting (index.html plus a
// _headers file that keeps the same no-outside-requests policy online), and writes the steps for
// Netlify Drop, Cloudflare Pages and GitHub Pages, with what to keep off a public link.
// Nothing is uploaded from here: the member drags the ZIP themselves.

const { views, files, save, text } = require('../../_kit');
const S = require('../lib/starters');
const { factsOf } = require('../lib/facts');
const { readApp, titleOf, configOf } = require('../lib/app-file');
const { validate, harden, summary } = require('../lib/validate');
const { deliver } = require('../lib/deliver');
const HOST = require('../data/hosting.json');

const { esc } = files;

function steps(host) {
  const n = HOST.netlify;
  const c = HOST.cloudflarePages;
  const g = HOST.githubPages;
  const all = {
    netlify: { name: 'Netlify Drop', lines: ['Download the ZIP below. Keep it zipped.', `Open ${n.dropUrl} on a computer and drag the ZIP onto the page.`, 'Netlify gives you a link in seconds. Sign up or log in to keep it: an unclaimed drop is password protected and expires on its own.', 'To update the app later, open the site in Netlify, go to Deploys, and drag the new ZIP there (dragging onto the sites list makes a new site).', n.freePlan], sources: n.sources },
    cloudflare: { name: 'Cloudflare Pages', lines: ['Download the ZIP below.', c.steps, c.freePlan], sources: c.sources },
    github: { name: 'GitHub Pages', lines: ['Unzip the ZIP below.', g.steps, g.caution], sources: g.sources },
  };
  return host === 'all' ? Object.values(all) : [all[host] || all.netlify];
}

const CARE = [
  'Anyone with the link can open the app. Leave private client details out of anything you put online, and use the app on your own phone instead for those.',
  'What people type is saved in their own browser, not on the website. You won\'t see their answers unless they send them to you.',
  'The _headers file asks search engines not to list the app and blocks every outside request, the same as on your phone.',
];

function guideHtml({ title, business, hosts }) {
  const body = hosts.map((h) => `<h2>${esc(h.name)}</h2><ol>${h.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ol><p class="src">Checked ${esc(HOST.checked)}: ${h.sources.map((s) => `<a href="${esc(s)}">${esc(s.replace(/^https:\/\//, '').split('/')[0])}</a>`).join(', ')}</p>`).join('');
  return files.htmlDoc({
    title: `Put ${title} online`,
    css: '@page{size:letter;margin:16mm}body{font:16px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;max-width:720px;margin:0 auto;padding:20px 16px;color:#111}h1{font-size:26px;letter-spacing:-.02em}h2{font-size:18px;margin-top:28px}li{margin:6px 0}.src{font-size:13px;color:#555}.care{border-left:3px solid #111;padding-left:12px}',
    body: `<p>${esc(business || '')}</p><h1>Put ${esc(title)} online</h1><p>Your app is one file. It already works offline on your phone; putting it online gives you a link to share.</p>${body}<h2>Before you share the link</h2><ul class="care">${CARE.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>`,
  });
}

module.exports = {
  name: 'tools.publish_kit',
  title: 'Put an app online',
  description: 'Checks your app, packs it for free drag-and-drop hosting with a _headers file that keeps it locked down, and writes the steps for Netlify Drop, Cloudflare Pages or GitHub Pages. You do the upload.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 1,
  input: {
    type: 'object',
    properties: {
      app: { type: 'string', format: 'asset', title: 'Your app (.html or .zip)' },
      host: { type: 'string', title: 'Where', enum: ['netlify', 'cloudflare', 'github', 'all'], default: 'netlify' },
      listed: { type: 'boolean', title: 'Let search engines list it', default: false },
      business: { type: 'string', title: 'Business name (optional)', maxLength: 80 },
    },
  },
  output: {
    type: 'object',
    properties: { app: { type: 'object' }, zip: { type: 'object' }, preview: { type: 'object' }, guide: { type: 'object' }, steps: { type: 'array', items: { type: 'object' } }, notes: { type: 'array', items: { type: 'string' } }, sample: { type: 'boolean' } },
    required: ['app', 'zip', 'guide', 'steps', 'notes'],
  },
  async run(input, ctx) {
    let html;
    let sample = false;
    if (input.app) html = (await readApp(ctx, input.app)).html;
    else {
      html = S.render('booking', factsOf(ctx, input), {}).html;
      sample = true;
    }
    const v = validate(harden(html), { maxBytes: 1500 * 1024 });
    if (!v.ok) throw new Error(`This app can't go online as it is. ${summary(v)} Run "Check an app" for the full list, or rebuild it here.`);
    const cfg = configOf(html);
    const title = titleOf(html);
    const business = (cfg && cfg.business) || input.business || '';
    const d = await deliver(ctx, html, { business, title, starter: (cfg && cfg.starter) || 'custom', listed: !!input.listed, maxBytes: 1500 * 1024 });
    const hosts = steps(input.host || 'netlify');
    const guide = await save.saveFile(ctx, save.fileName(business || 'my', text.slug(title, 30), 'put-online', '.html'), guideHtml({ title, business, hosts }));
    const notes = [...CARE];
    if (sample) notes.unshift('No app was added, so this packs a sample booking page. Add your app\'s ZIP or .html file to pack yours.');
    if (input.listed) notes[notes.length - 1] = 'Search engines may list this app (you asked for that). The _headers file still blocks every outside request.';
    ctx.log(`Packed ${title} for ${hosts.map((h) => h.name).join(', ')}`);
    return { app: d.app, zip: d.zip, preview: d.preview, guide, steps: hosts.map((h) => ({ host: h.name, steps: h.lines.join(' ') })), notes, sample };
  },
  view(out) {
    return views.blocks(
      views.sampleNote(out, 'This app'),
      views.metric('Ready to put online', out.app.title, 'One file plus _headers, checked'),
      views.file(out.zip, 'ZIP to drag onto Netlify Drop or Cloudflare Pages'),
      views.table([{ key: 'host', label: 'Where' }, { key: 'steps', label: 'Steps' }], out.steps),
      ...out.notes.map((n) => views.text(n)),
      views.file(out.guide, 'Printable steps'),
      views.link('Open Netlify Drop', HOST.netlify.dropUrl)
    );
  },
};
