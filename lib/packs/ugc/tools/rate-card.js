// The member's rate card: a per-video price for their level, add-ons (hooks, raw footage, paid ad
// use, whitelisting, rush), a monthly bundle priced per video, the usage terms in plain words, the
// disclosure lines and what each platform keeps. A PNG to send and a printable page.

const { views, save, files, money, svg, media, color, text } = require('../../_kit');
const U = require('../lib/ugc');
const offer = require('../lib/offer');

function cardSvg(card, name, pal) {
  const W = 1080;
  const H = 1350;
  const rows = [
    ['One video, 15 to 60 seconds', money.usd(card.video)],
    ...card.addons.map((a) => [`${a.label}`, `+${money.usd(a.price)} ${a.unit}`]),
    [`${card.bundle.label}: ${card.bundle.videos} videos`, `${money.usd(card.bundle.each)} each`],
  ];
  const body = [
    svg.rect({ x: 0, y: 0, w: W, h: 260, fill: pal.primary }),
    svg.text({ x: 80, y: 130, lines: [text.clip(name || 'UGC rate card', 32)], size: 64, weight: 800, fill: pal.onPrimary }),
    svg.text({ x: 80, y: 200, lines: ['Short product videos for brands. Prices per video.'], size: 32, weight: 500, fill: pal.onPrimary, opacity: 0.9 }),
    ...rows.map((r, i) => {
      const y = 360 + i * 98;
      return [
        svg.text({ x: 80, y, lines: [r[0]], size: 34, weight: i === 0 ? 700 : 500, fill: pal.ink }),
        svg.text({ x: 1000, y, lines: [r[1]], size: 34, weight: 700, fill: i === 0 ? pal.primary : pal.ink, anchor: 'end' }),
        svg.line({ x1: 80, y1: y + 36, x2: 1000, y2: y + 36, stroke: pal.line, strokeWidth: 2 }),
      ].join('');
    }),
    svg.text({ x: 80, y: H - 110, lines: [`Delivery in ${card.turnaround} days. ${card.revisions} round of edits included.`, 'Half up front to book, half on delivery.'], size: 30, weight: 500, fill: pal.muted, lineHeight: 1.35 }),
  ].join('');
  return svg.doc({ width: W, height: H, background: pal.paper, body });
}

function cardHtml(card, name, termList, rules, pal) {
  const row = (a, b) => `<tr><td>${files.esc(a)}</td><td class="r">${files.esc(b)}</td></tr>`;
  const css = `@page{size:letter;margin:0.6in}body{font-family:Inter,Arial,sans-serif;color:${pal.ink};background:${pal.paper};max-width:760px;margin:0 auto;padding:24px}h1{color:${pal.primary};margin:0 0 4px}h2{margin-top:28px;font-size:18px}table{width:100%;border-collapse:collapse}td{padding:8px 0;border-bottom:1px solid ${pal.line}}.r{text-align:right;font-weight:700}.note{color:${pal.muted};font-size:13px}`;
  const body = [
    `<h1>${files.esc(name || 'UGC rate card')}</h1><p>Short product videos for brands. Prices per video, in US dollars.</p>`,
    '<h2>Videos</h2><table>',
    row('One video, 15 to 60 seconds, organic use', money.usd(card.video)),
    ...card.addons.map((a) => row(`${a.label} (${a.unit})`, `+${money.usd(a.price)}`)),
    row(`${card.bundle.label}: ${card.bundle.videos} videos each month`, `${money.usd(card.bundle.each)} per video`),
    '</table>',
    `<p class="note">Delivery in ${card.turnaround} days. ${card.revisions} round of edits included. Half up front to book the date, half on delivery.</p>`,
    '<h2>Usage terms in plain words</h2>',
    ...termList.map((t) => `<p><b>${files.esc(t.title)}.</b> ${files.esc(t.text)}</p>`),
    '<h2>Disclosure when you post on your own account</h2>',
    `<p>Say it in the video: "${files.esc(text.fill(rules.disclosure.spoken, { brand: 'Brand name' }))}" and add to the caption: "${files.esc(text.fill(rules.disclosure.caption, { brand: 'Brand name' }))}"</p>`,
  ].join('\n');
  return files.htmlDoc({ title: `${name || 'UGC'} rate card`, css, body });
}

module.exports = {
  name: 'ugc.rate_card',
  title: 'Make the rate card',
  description: 'Prices one video for your level, the add-ons brands ask for (hooks, raw footage, paid ad use, whitelisting, rush) and a 4-video monthly bundle, with usage terms in plain words, disclosure lines and what each platform keeps.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  wants: ['render'],
  credits: 1,
  input: {
    type: 'object',
    properties: {
      level: { type: 'string', title: 'Where are you now?', enum: ['new', 'some', 'pro'], default: 'new' },
      price: { type: 'number', title: 'Your own price per video (optional)', minimum: 30, maximum: 2000 },
      name: { type: 'string', title: 'Your name or creator name' },
      color: { type: 'string', title: 'Your brand color (optional)' },
    },
  },
  output: { type: 'object', properties: { card: { type: 'object' }, terms: { type: 'array' }, image: { type: ['object', 'null'] }, page: { type: 'object' }, text: { type: 'object' } }, required: ['card'] },
  async run(input, ctx) {
    // A typed price wins, then the price saved in "Your offer" (at the same level), then the level's price.
    const saved = offer.remembered(ctx);
    const level = input.level || saved.level || 'new';
    const base = money.num(input.price, null) || (Number(saved.video) >= 30 && (!saved.level || saved.level === level) ? Number(saved.video) : undefined);
    const card = U.rateCard(level, { base });
    const name = text.clip(input.name || (ctx.member && ctx.member.firstName ? `${ctx.member.firstName} UGC` : 'UGC rate card'), 40);
    const pal = color.palette(color.isHex(input.color || '') ? input.color : 'bold');
    const termList = U.terms('the brand');
    const s = cardSvg(card, name, pal);
    let image = null;
    if (media.canRender(ctx)) image = await save.saveFile(ctx, save.fileName(name, 'rate-card', '.png'), await media.svgToPng(ctx, s, { width: 1080, height: 1350 }));
    const page = await save.saveFile(ctx, save.fileName(name, 'rate-card', '.html'), cardHtml(card, name, termList, U.RULES, pal));
    const plainText = [
      `${name}: rate card (per video, US dollars)`,
      `One video, 15 to 60 seconds, organic use: ${money.usd(card.video)}`,
      ...card.addons.map((a) => `${a.label}: +${money.usd(a.price)} ${a.unit}`),
      `${card.bundle.label}: ${card.bundle.videos} videos each month at ${money.usd(card.bundle.each)} per video`,
      '',
      'Usage terms',
      ...termList.map((t) => `${t.title}: ${t.text}`),
      '',
      `Disclosure: say "${text.fill(U.RULES.disclosure.spoken, { brand: 'Brand name' })}" in the video and add "${text.fill(U.RULES.disclosure.caption, { brand: 'Brand name' })}" to the caption.`,
      '',
      'What you keep on one video',
      ...card.fees.map((f) => `${f.platform}: fee ${money.usd(f.fee, { cents: true })}, you keep ${money.usd(f.keep, { cents: true })}`),
    ].join('\n');
    const txt = await save.saveFile(ctx, save.fileName(name, 'rate-card-and-terms', '.txt'), plainText);
    ctx.log(`Priced one video at ${money.usd(card.video)} with ${card.addons.length} add-ons`);
    return { card, terms: termList, image, page, text: txt };
  },
  view(out) {
    const c = out.card;
    return views.blocks(
      views.metric('One video', money.usd(c.video), c.levelLabel),
      views.metric(`${c.bundle.label}, per video`, money.usd(c.bundle.each), `${c.bundle.videos} videos a month`),
      views.table([{ key: 'label', label: 'Add-on' }, { key: 'price', label: 'Price' }, { key: 'unit', label: 'Per' }], c.addons.map((a) => ({ label: a.label, price: `+${money.usd(a.price)}`, unit: a.unit }))),
      views.table([{ key: 'platform', label: 'Paid through' }, { key: 'keep', label: 'You keep on one video' }], c.fees.map((f) => ({ platform: f.platform, keep: money.usd(f.keep, { cents: true }) }))),
      views.image(out.image, 'Rate card to send when a brand asks'),
      views.file(out.page, 'Rate card and terms (print or save as PDF)'),
      views.file(out.text, 'Rate card and terms (.txt)'),
    );
  },
};
