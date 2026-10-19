// "Your offer" for a UGC creator: three packages a brand can say yes to (a test video, an ad starter
// and a monthly plan) at the member's level or their own price, the add-ons, founding terms for the
// first 3 brands, the use in plain words, the FTC disclosure line, what to promise and what never
// to, and how to say the price once. A printable offer sheet to send when a brand asks for rates and
// a picture of it for DMs. Remembers the offer so every reply, call card, brief and report quotes it.

const kit = require('../../_kit');
const { views, save, money, svg, media, text, time, brain } = kit;
const NICHE = require('../data/niche.json');
const RATES = require('../data/rates.json');
const offer = require('../lib/offer');
const U = require('../lib/ugc');
const pages = require('../lib/pages');
const talk = require('../../_kit/talk');

const usd = (n) => money.usd(n);

function pictureSvg(n, name, pal, founding) {
  const W = 1080;
  const H = 1350;
  const rows = n.packages.map((k, i) => {
    const y = 330 + i * 290;
    const lines = k.includes.slice(0, 3);
    return [
      svg.rect({ x: 60, y: y - 70, w: 960, h: 250, r: 22, fill: i === 1 ? pal.surface : '#ffffff', stroke: i === 1 ? pal.primary : pal.line, strokeWidth: i === 1 ? 4 : 2 }),
      svg.text({ x: 100, y, lines: [k.name], size: 44, weight: 800, fill: pal.ink }),
      svg.text({ x: 980, y, lines: [`${usd(k.price)}${k.per ? ` ${k.per}` : ''}`], size: 44, weight: 800, fill: pal.primary, anchor: 'end' }),
      svg.text({ x: 100, y: y + 60, lines: lines.map((l) => text.clip(l, 52)), size: 30, weight: 500, fill: pal.muted, lineHeight: 1.35 }),
    ].join('');
  });
  const body = [
    svg.rect({ x: 0, y: 0, w: W, h: 210, fill: pal.primary }),
    svg.text({ x: 60, y: 110, lines: [text.clip(name || 'UGC rates', 30)], size: 60, weight: 800, fill: pal.onPrimary }),
    svg.text({ x: 60, y: 170, lines: ['Short product videos for brands, in US dollars'], size: 30, weight: 500, fill: pal.onPrimary, opacity: 0.92 }),
    ...rows,
    founding && founding.open ? svg.text({ x: 60, y: H - 190, lines: [`My first ${founding.count} brands get the test video at ${usd(founding.price)}.`], size: 32, weight: 700, fill: pal.primary }) : '',
    svg.text({ x: 60, y: H - 120, lines: [`Add-ons: extra hooks ${usd(n.hook)}, raw footage ${usd(n.raw)}, ad use ${usd(n.ads30)} a video.`, `Videos in ${n.turnaround} days from the product arriving. One round of edits.`], size: 28, weight: 500, fill: pal.muted, lineHeight: 1.4 }),
  ].join('');
  return svg.doc({ width: W, height: H, background: pal.paper, body });
}

module.exports = {
  name: 'ugc.build_offer',
  title: 'Build your UGC offer',
  description: 'Prices three packages brands can say yes to (a test video, an ad starter and a monthly plan) at your level, with add-ons, founding terms for your first 3 brands, the use in plain words and the FTC disclosure line, as an offer sheet and a picture. Remembers it for every reply and brief.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  wants: ['render'],
  credits: 2,
  input: {
    type: 'object',
    properties: {
      level: { type: 'string', title: 'Where are you now?', enum: offer.LEVELS, default: 'new' },
      price: { type: 'number', title: 'Your own price for one video (optional)', minimum: 30, maximum: 2000 },
      name: { type: 'string', title: 'Your creator or business name', maxLength: 60 },
      contact: { type: 'string', title: 'Your email (printed on the sheet)', maxLength: 120 },
      site: { type: 'string', title: 'Portfolio link (optional)', maxLength: 300 },
      color: { type: 'string', title: 'Your brand color (optional)', maxLength: 7 },
    },
  },
  output: { type: 'object', required: ['packages', 'say', 'sheet'], properties: { packages: { type: 'array' }, say: { type: 'object' }, sheet: { type: 'object' }, picture: { type: 'object' }, founding: { type: 'object' } } },
  timeoutSec: 60,
  async run(input, ctx) {
    const br = brain.brainOf(ctx, {});
    const n = offer.offerNumbers({ level: input.level, price: input.price }, ctx, { useSaved: false });
    const name = text.clip(text.oneLine(input.name || br.name || (ctx.member && ctx.member.firstName ? `${ctx.member.firstName} UGC` : 'UGC rates')), 60);
    const site = talk.siteUrl(input.site || br.website || '');
    const contact = text.oneLine(input.contact || '');
    const rows = await talk.pipelineRows(ctx);
    const clients = talk.wonCount(rows, 'ugc');
    const open = clients < NICHE.first_clients.founding_count;
    const founding = { open, count: NICHE.first_clients.founding_count, price: n.founding, ask: NICHE.first_clients.ask, clients, basis: NICHE.first_clients.basis };
    const say = offer.priceSay(n, { founding: open });
    const usage = offer.usageFor('the brand', { whitelist: true, raw: true });
    // The sheet goes to many brands, so it names the lines without a placeholder in brackets.
    const lead = (line) => String(line || '').split('{brand}')[0].trim();
    const disclosure = { ...offer.disclosureFor('your brand'), spokenLead: lead(U.RULES.disclosure.spoken), captionLead: lead(U.RULES.disclosure.caption) };
    const lines = offer.disclosureFor('Brand name');
    const brandPosts = offer.disclosureFor('the brand').brandPosts;
    const today = time.today(ctx);
    const validUntil = time.longDate(time.addDays(today, 30));
    const pal = pages.paletteOf(input.color);

    // "Maya Brooks UGC" -> maya-brooks-ugc-offer, not ...-ugc-ugc-offer.
    const fileTag = /\bugc$/i.test(String(name || '').trim()) ? 'offer' : 'ugc-offer';
    const sheet = await save.saveFile(ctx, save.fileName(name, fileTag, '.html'), pages.offerSheetHtml({ name, contact, site, n, founding, usage, disclosure, validUntil, color: input.color }), 'text/html');
    let picture = null;
    if (media.canRender(ctx)) {
      try {
        picture = await save.saveFile(ctx, save.fileName(name, fileTag, '.png'), await media.svgToPng(ctx, pictureSvg(n, name, pal, founding), { width: 1080, height: 1350 }), 'image/png');
      } catch {
        picture = null;
      }
    }
    if (!picture) picture = await save.saveFile(ctx, save.fileName(name, fileTag, '.svg'), pictureSvg(n, name, pal, founding), 'image/svg+xml');

    await brain.remember(ctx, 'offer', { level: n.level, video: n.video, saved: today });
    ctx.log(`Your offer: test video ${usd(n.video)}, ad starter ${usd(n.starter)}, monthly ${usd(n.monthly)} a month`);
    const promises = [
      `The videos on the day we agree, ${n.turnaround} days after the product arrives`,
      'One round of edits if they ask within 5 days',
      'A redo if a video misses the brief they approved',
      'The use in writing, before you film',
    ];
    const never = ['Views, sales, followers or any result', 'That you use or love a product before you have used it', 'A post on your account without "#ad" and the spoken line'];
    const time_ = [
      { what: 'Test video', hours: 'about 3 hours: the brief, filming, editing and delivery' },
      { what: 'Ad starter', hours: 'about 7 hours for the 3 videos and 3 hooks' },
      { what: 'Monthly', hours: 'about 9 hours a month for 4 videos and the report' },
    ];
    const basis = [
      `${RATES.levels[n.level].label}: ${usd(RATES.levels[n.level].video)} a video. ${RATES.levels[n.level].note}`,
      'Ad starter: 3 videos, 3 extra hooks and 30 days of ad use. Clipspeed lists starter bundles of 3 videos at $400 to $900.',
      `Monthly: ${RATES.bundle.videos} videos at ${Math.round(RATES.bundle.discount * 100)}% off each (judgment from retainer outlines). Sources and dates are in research/niches/ugc.json, checked ${RATES.checked}.`,
      founding.basis,
    ];
    return { name, lines: { spoken: lines.spoken, caption: lines.caption, setting: lines.setting, gifted: lines.gifted, brandPosts }, n: { video: n.video, starter: n.starter, monthly: n.monthly, each: n.each, founding: n.founding, hook: n.hook, raw: n.raw, ads30: n.ads30, ads90: n.ads90, whitelist: n.whitelist, rush: n.rush, level: n.level, levelLabel: n.levelLabel }, packages: n.packages, say, founding, usage, disclosure, promises, never, time: time_, basis, sheet, picture, validUntil };
  },
  view(out) {
    const f = out.founding || {};
    return views.blocks(
      views.metric('Test video', usd(out.n.video), out.n.levelLabel),
      views.cards(out.packages.map((k) => ({ title: `${k.name}: ${usd(k.price)}${k.per ? ` ${k.per}` : ''}`, subtitle: k.goodFor, body: k.includes.join('. ') }))),
      views.copy('Say the price once', [out.say.base, out.say.founding].filter(Boolean).join(' ')),
      f.open ? views.text(f.clients ? `Founding brands: you have ${f.clients} paying brand${f.clients === 1 ? '' : 's'}, so the next ${f.count - f.clients} get the test video at ${usd(f.price)}.` : `Founding brands: no paying brands yet, so your first ${f.count} get the test video at ${usd(f.price)}.`) : null,
      views.copy('The disclosure line for your own posts (put in the brand\'s name)', `Say in the video: "${out.lines.spoken}"\nAdd to the caption: "${out.lines.caption}"\n${out.lines.setting}`),
      views.text(`${out.lines.gifted} ${out.lines.brandPosts}`),
      views.cards(out.usage.map((t) => ({ title: t.title, body: t.text }))),
      views.cards([
        { title: 'What you promise', body: out.promises.join('. ') },
        { title: 'What you never promise', body: out.never.join('. ') },
      ]),
      views.table([{ key: 'what', label: 'Package' }, { key: 'hours', label: 'Your time, roughly' }], out.time),
      views.file(out.sheet, 'Offer sheet to send when a brand asks for rates (print or save as PDF)'),
      out.picture && /png/.test(out.picture.type || out.picture.name || '') ? views.image(out.picture, 'The offer as a picture, for DMs') : views.file(out.picture, 'The offer as a picture, for DMs'),
      views.text(`Where the prices come from: ${out.basis.join(' ')}`),
    );
  },
};
