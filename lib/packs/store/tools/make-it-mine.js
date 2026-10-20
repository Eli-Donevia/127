// store.make_it_mine: fills one Store template with the member's details and saves the files to
// their Library as <id>-<business-slug>.<ext>.
//
// Code only. Nothing here goes to Anthropic: no ctx.ai call, no ctx.fetch, no outside service. It
// reads the member's own brain (ctx.brain) and the Store's files on this server, fills them in and
// saves them for the member, so it needs no Legal line (STORE-SCHEMA.md). An AI "Write it for me"
// step would be a separate tool, behind its own flag and a Legal line.

const fs = require('fs');
const path = require('path');
const store = require('../../../store');
const flags = require('../../../harness/flags');
const { canAccess } = require('../../../plans');
const { text, save } = require('../../_kit');
const fill = require('../lib/fill');
const { valuesFor } = require('../lib/values');

const obj = (properties, required = []) => ({ type: 'object', properties, required });

// ctx.member has no email, so the member's account comes from the database. A run with no saved account
// (the test kit's ctx) only needs STORE_V2 to be on or admins.
function storeOpenFor(member) {
  if (flags.value('STORE_V2') === 'off') return false;
  let user = null;
  try {
    user = member && member.id ? require('../../../db').get('users', member.id) : null;
  } catch {
    user = null;
  }
  return user ? store.enabledFor(user) : true;
}
const ASSET = obj({ id: { type: 'string' }, url: { type: 'string' }, name: { type: 'string' }, type: { type: 'string' }, bytes: { type: 'integer' } }, ['id', 'url', 'name']);
const TOKEN_ROW = obj({ token: { type: 'string' }, label: { type: 'string' } }, ['token', 'label']);

// "127-hero-split.liquid" for item "shopify-sections" -> "hero-split": what tells two files of
// the same type apart.
function stemOf(name, id) {
  return path.basename(name, path.extname(name)).replace(/^127-/, '').replace(new RegExp(`^${id}-?`), '') || '';
}

function outNames(item, names, slug) {
  const exts = names.map((n) => path.extname(n).toLowerCase());
  const used = new Set();
  return names.map((n, i) => {
    const ext = exts[i];
    const shared = exts.filter((e) => e === ext).length > 1;
    let base = `${item.id}-${slug}`;
    if (shared) base += `-${text.slug(stemOf(n, item.id), 40) || i + 1}`;
    let out = `${base}${ext}`;
    for (let k = 2; used.has(out); k++) out = `${base}-${k}${ext}`;
    used.add(out);
    return out;
  });
}

module.exports = {
  name: 'store.make_it_mine',
  title: 'Make it mine',
  description: 'Fills a Store template with the details saved in Your business and saves the filled files to the Library. Pure code, no AI.',
  kind: 'code',
  risk: 'draft',
  credits: 1,
  input: obj(
    {
      item: { type: 'string', title: 'Store item', pattern: '^[a-z0-9][a-z0-9-]{0,80}$' },
      email: { type: 'string', title: 'Email for customers', maxLength: 120 },
      phone: { type: 'string', title: 'Phone for customers', maxLength: 40 },
    },
    ['item'],
  ),
  output: obj(
    {
      item: { type: 'string' },
      title: { type: 'string' },
      disclaimer: { type: ['string', 'null'] },
      files: { type: 'array', items: obj({ asset: ASSET, label: { type: 'string' } }, ['asset', 'label']) },
      filled: { type: 'array', items: TOKEN_ROW },
      fillYourself: { type: 'array', items: TOKEN_ROW },
      cellsLeft: { type: 'array', items: { type: 'string' } },
    },
    ['item', 'title', 'files', 'filled', 'fillYourself', 'cellsLeft'],
  ),

  async run(input, ctx) {
    // The same gate as the Store's pages (flags.on, so "on" reaches members only while TERMS_LIVE and
    // PRIVACY_LIVE are true), since a hidden workflow can still be started from HQ's own run route.
    if (!storeOpenFor(ctx.member)) throw new Error("The Store isn't open yet.");
    const lib = store.current();
    const item = store.get(input.item, lib);
    if (!item || item.status !== 'ready' || !item.makeItMine) throw new Error("That template can't be filled in yet.");
    if (!canAccess({ tier: (ctx.member && ctx.member.tier) || 'free' }, item.tier)) throw new Error(`${item.title} is part of Builder.`);

    const values = valuesFor({ brain: ctx.brain || {}, member: ctx.member || {}, inputs: input, now: ctx.now() });
    const rep = fill.report();
    const opts = { values, tokens: lib.tokens, report: rep, now: ctx.now() };
    const slug = text.slug(values['business.name'] || '', 40) || 'mine';
    const names = item.makeItMine.files;
    const outs = outNames(item, names, slug);
    const saved = [];
    const cellsLeft = [];
    for (let i = 0; i < names.length; i++) {
      const src = store.sourceFile(item.id, names[i], lib);
      if (!src || !fs.existsSync(src.abs)) throw new Error(`${item.title}'s files aren't here yet. Try again later.`);
      let data = fs.readFileSync(src.abs);
      if (src.tpl) data = fill.fillBuffer(names[i], data, opts);
      if (src.file.ext === '.xlsx' && item.makeItMine.cells.length) {
        const r = fill.setCells(data, item.makeItMine.cells, opts);
        data = r.data;
        cellsLeft.push(...r.left);
      }
      const asset = await save.saveFile(ctx, outs[i], data);
      saved.push({ asset, label: src.file.label });
    }
    ctx.log(`Filled ${saved.length} ${saved.length === 1 ? 'file' : 'files'} from Your business`);
    const row = (token) => ({ token, label: (lib.tokens[token] || {}).label || token });
    return {
      item: item.id,
      title: item.title,
      disclaimer: item.disclaimer || null,
      files: saved,
      filled: [...rep.used].filter((t) => !rep.missing.has(t)).sort().map(row),
      fillYourself: [...rep.missing].sort().map(row),
      cellsLeft,
    };
  },

  view(o) {
    // The date and the member's first name alone aren't "your details": with nothing from Your business or the form, say so.
    const mine = o.filled.some((t) => !['today', 'year', 'owner.first'].includes(t.token));
    const blocks = [{ type: 'text', text: mine ? `${o.title}, filled in with your details.` : `${o.title}, saved to your Library. Your business is empty, so most of it still reads like the blank template.` }];
    for (const f of o.files) blocks.push({ type: 'file', asset: f.asset, label: f.asset.name, caption: f.label });
    if (o.filled.length) blocks.push({ type: 'text', text: `Filled in for you: ${o.filled.map((t) => t.label).join(', ')}.` });
    if (o.fillYourself.length) {
      blocks.push({ type: 'text', text: `Fill these in yourself: ${o.fillYourself.map((t) => t.label).join(', ')}. Add them in Your business and make it again, or type them into the file.` });
      blocks.push({ type: 'link', label: 'Your business', href: '/app/hq/brain' });
    }
    if (o.disclaimer) blocks.push({ type: 'text', text: o.disclaimer, muted: true });
    return blocks;
  },
};
