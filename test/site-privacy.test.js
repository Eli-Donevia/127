// The site pack's privacy notice and store policies (Legal L76 W1, W3): every site gets privacy.html, linked in every
// footer and under every form; blocks follow what the site uses; a site needs a name and an email, a store both policies.
const test = require('node:test');
const assert = require('node:assert/strict');
const { factsFrom } = require('../lib/packs/site/lib/facts');
const { buildSite } = require('../lib/packs/site/lib/site');
const ex = require('../lib/packs/site/sample/examples.json');

const { rankTemplates } = require('../lib/packs/site/lib/pick');
const build = (input, opts = {}) => { const facts = factsFrom(null, input, { own: false }); return buildSite(null, { facts, template: rankTemplates(facts)[0].id, render: false, ...opts }); };
const file = (r, name) => { const f = r.files.find((x) => x.name === name); return f ? String(f.data) : null; };

test('every site gets a privacy notice, linked in the footer and under its forms', async () => {
  const r = await build({ ...ex['site.quick_site'] });
  const p = file(r, 'privacy.html'), index = file(r, 'index.html');
  assert.ok(p && /This notice explains what Reyes Mobile Detailing collects through this website/.test(p));
  assert.match(p, /Last updated/);
  assert.match(p, /our website host, Netlify;/);
  assert.match(p, /When you book with us/);
  assert.ok(!/When you buy from us|Our email list|Texts\./.test(p));
  assert.ok(!/not legal advice/i.test(p), 'the starter label stays off the page');
  assert.match(index, /<a href="privacy\.html">Privacy<\/a><\/p>\n<\/footer>|class="legal-links"/);
  assert.match(index, /We'll only use this to reply to you\. <a href="privacy\.html">Privacy<\/a>/);
  assert.deepEqual(r.blockers, []);
  assert.match(file(r, 'README.txt'), /Starter privacy notice, not legal advice/);
});

test('no email, no going online; a store needs its shipping and returns policies', async () => {
  const noEmail = { business: 'Harbor Lane', what: 'Dog grooming', phone: '813-555-0100' };
  const r0 = await build(noEmail);
  assert.ok(r0.blockers.some((b) => /email/.test(b)));
  assert.match(file(r0, 'README.txt'), /^NOT READY TO GO ONLINE YET\n1\. Add your email/m);
  assert.match(file(r0, 'privacy.html'), /Email us at \[add your email\]/);
  assert.deepEqual((await build(noEmail, { mode: 'prospect' })).blockers, []);
  const shop = { business: 'Halden Goods', what: 'Insulated water bottles', email: 'hi@halden.example', buy: 'https://halden.myshopify.com/products/one' };
  const r1 = await build(shop);
  assert.equal(r1.blockers.length, 2);
  assert.match(file(r1, 'policies.html'), /\[add your shipping policy\][\s\S]*\[add your refund and return policy\]/);
  const r2 = await build({ ...shop, shipping: 'Ships in 2 business days.', returns: '30-day returns on unused bottles.' });
  assert.deepEqual(r2.blockers, []);
  assert.match(file(r2, 'policies.html'), /30-day returns on unused bottles/);
  assert.match(file(r2, 'index.html'), /policies\.html">Shipping and returns/);
  assert.match(file(r2, 'privacy.html'), /When you buy from us[\s\S]*Shopify handles your payment/);
});

test("127's site chat: its button and its block in privacy.html, only when the member pasted its code", async () => {
  const key = 'a'.repeat(32);
  const snippet = `<script src="https://127group.io/js/site-chat-embed.js" data-chat="${key}" async></script>`;
  const r = await build({ ...ex['site.quick_site'], chat: `${snippet}<script>alert(1)</script>` });
  const p = file(r, 'privacy.html'), index = file(r, 'index.html');
  assert.ok(index.includes(snippet));
  assert.ok(!index.includes('alert(1)'), 'only the snippet itself reaches the page');
  assert.match(p, /<strong>Our website chat\.<\/strong> The chat on our site is an AI assistant/);
  assert.match(p, /<a href="https:\/\/127group\.io\/site-chat">How 127 runs this chat<\/a>/);
  assert.match(p, /<li>127, which runs our website chat, and its AI provider, Anthropic\.<\/li><\/ul>/);
  assert.ok(p.indexOf('Our website chat') < p.indexOf('When you visit'), "in the starter's order");
  assert.match(file(r, 'README.txt'), /privacy\.html as your privacy page/);
  const off = await build({ ...ex['site.quick_site'] });
  assert.ok(!/site-chat|website chat/.test(file(off, 'privacy.html') + file(off, 'index.html')));
  const sample = await build({ ...ex['site.quick_site'], chat: key }, { mode: 'prospect' });
  assert.ok(!file(sample, 'index.html').includes('site-chat-embed'), "never on a sample for someone else");
});
