// Proof for a reseller: a "Sold" card (1080 x 1350) with the item's photo, where it sold and how fast,
// and a caption that points to the shop. It shows what sold, never what you made on it, and never a
// buyer's name, username or address (data/niche.json `sold`).

const { views, save, money, text } = require('../../_kit');
const C = require('../../_kit/common');

const { num } = money;
const { plain, clip } = text;

// Money and profit talk come out of anything the card shows.
const NO_MONEY = /\$\s?\d[\d,]*(?:\.\d\d)?|\b\d+\s?(?:dollars|bucks)\b|\b(?:sold|flipped|went|listed) (?:for|at)\b|\b(?:profit|made|margin|roi)\b[^,.]*/gi;

function soldCardTool(N) {
  const S = N.sold;
  const where = [...N.platforms.map((p) => p.id), 'local'];
  return {
    name: 'resale.make_sold_card',
    title: 'Sold card',
    description: 'A 1080 x 1350 "Sold" card with the item photo, where it sold and how fast, plus a caption that points to your shop. Never the price you made or the buyer.',
    kind: 'code',
    risk: 'draft',
    needs: [],
    wants: ['render'],
    credits: 2,
    timeoutSec: 120,
    input: {
      type: 'object',
      required: ['item'],
      properties: {
        item: { type: 'string', maxLength: 100, title: 'What sold', description: 'Like "Levi\'s 501 jeans, 34x32"' },
        photo: { type: 'string', format: 'asset', accept: 'image/*', title: 'Its photo (optional)', description: 'Your own listing photo' },
        where: { type: 'string', enum: where, title: 'Where it sold (optional)' },
        days: { type: 'integer', minimum: 0, maximum: 999, title: 'Days it took to sell (optional)' },
        link: { type: 'string', maxLength: 300, title: 'Your shop link (optional)', description: 'Starts with https://' },
        business: { type: 'string', maxLength: 80, title: 'Shop name (optional)' },
      },
    },
    output: { type: 'object', required: ['card', 'caption'], properties: { card: { type: 'object' }, caption: { type: 'string' }, png: { type: 'boolean' } } },
    async run(input, ctx) {
      const item = clip(plain(input.item || '').replace(NO_MONEY, '').replace(/\s{2,}/g, ' ').replace(/[\s,;:-]+$/, '').trim(), 100);
      if (!item) throw new Error('Add what sold, like "Levi\'s 501 jeans, 34x32".');
      const me = C.who(ctx, input);
      const place = where.includes(input.where) ? input.where : '';
      const site = place === 'local' ? 'locally' : place ? `on ${N.platforms.find((p) => p.id === place).name}` : '';
      const days = num(input.days, null);
      const fast = days == null ? '' : days === 0 ? 'the day it was listed' : `in ${days} ${days === 1 ? 'day' : 'days'}`;
      const caption = C.fill(S.caption, {
        item,
        on: site ? ` ${site}` : '',
        days: fast ? ` ${fast}` : '',
        more: me.link ? C.fill(S.more_link, { link: me.link }) : S.more_plain,
      }).replace(/\s{2,}/g, ' ');
      const photo = await C.photoFor(ctx, input.photo);
      const business = me.business || 'Just sold';
      const line = [site ? `Sold ${site}` : 'Sold', fast].filter(Boolean).join(' ');
      const svgString = C.cardSvg({
        color: C.PALETTE.resale,
        business,
        area: me.area,
        badge: 'SOLD',
        photo,
        big: item,
        lines: [`${line}.`, me.link ? 'More finds like this in my shop.' : 'More finds like this coming soon.'],
        foot: me.link ? me.link.replace(/^https:\/\//, '') : business,
      });
      const saved = await C.saveCard(ctx, svgString, save.fileName(item, 'sold card'));
      return { card: saved.asset, png: saved.png, photo: !!photo, caption, item, rules: S.rules };
    },
    view(out) {
      return views.blocks(
        views.image(out.card, out.png ? 'Sold card (1080 x 1350)' : 'Sold card (SVG: open it in your browser to save or share it)'),
        views.copy('Caption', out.caption),
        views.text(`Post it to your shop's story or feed. ${out.rules.join(' ')}`),
        out.photo ? null : views.text('Add your own listing photo next time, so people see the item itself.'),
      );
    },
  };
}

module.exports = { soldCardTool };
