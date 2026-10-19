// The spec asset: a review card kit for one shop, made before they've said yes. A counter card and
// 8 handout cards with a QR code to their Google listing (or their own review link once they sign),
// the ask for every customer, reply templates, a fill-in starting point, a picture of the card for
// the follow-up, and the email that offers it. Never cites a Google rating or count outside the run.
// A shop found on OpenStreetMap carries the map credit in the page footer (D27).

const kit = require('../../_kit');
const { text, views, save, brain, media, time, outreach } = kit;
const NICHE = require('../data/niche.json');
const { reviewLink, cardCopy, kitHtml, cardPicture } = require('../lib/cardkit');
const { longDate, domainOf } = require('../../_kit/talk');

const SHOPS = Object.keys(NICHE.shops);

async function scanSite(ctx, website, checked) {
  const url = website && kit.web.normalizeUrl(website);
  if (!url) return null;
  const L = kit.leads;
  if (L.isSampleUrl(url)) return { ...L.sampleScan(url, { year: Number(checked.slice(0, 4)) }), sample: true };
  try {
    return await L.scanFor(ctx, url);
  } catch (e) {
    return { reachable: false, url };
  }
}

// Blank lines never stack.
const tidy = (lines) => lines.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');

module.exports = {
  name: 'reviews.card_kit',
  title: 'Review card kit',
  description: 'Makes a print-ready review card kit for one shop: a counter card and handout cards with a QR code to their Google listing, the ask for every customer, reply templates, a picture of the card and the email that offers it.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  wants: ['render'],
  credits: 5,
  input: {
    type: 'object',
    properties: {
      lead: { type: 'object' },
      business: { type: 'string', maxLength: 100 },
      website: { type: 'string', maxLength: 300 },
      reviewLink: { type: 'string', maxLength: 300 },
      placeId: { type: 'string', maxLength: 300 },
      shop: { type: 'string', enum: SHOPS },
      city: { type: 'string', maxLength: 120 },
      myName: { type: 'string', maxLength: 60 },
      myBusiness: { type: 'string', maxLength: 80 },
      myContact: { type: 'string', maxLength: 160 },
      myAddress: { type: 'string', maxLength: 160 },
      sendCopy: { type: 'boolean' },
    },
  },
  output: { type: 'object', required: ['name', 'link', 'page'], properties: { name: { type: 'string' }, link: { type: 'object' }, page: { type: 'object' }, owner: { type: 'string' }, email: { type: 'string' } } },
  timeoutSec: 90,
  async run(input, ctx) {
    const br = brain.brainOf(ctx, {});
    const lead = input.lead || {};
    const checked = time.today(ctx);
    const day = longDate(checked);
    const shop = SHOPS.includes(input.shop) ? input.shop : SHOPS.includes(lead.shop) ? lead.shop : 'salons';
    const S = NICHE.shops[shop];
    const city = text.plain(input.city || lead.city || br.place || br.city || '');
    const website = String(input.website || lead.website || '').trim();
    const scan = await scanSite(ctx, website, checked);
    const fromSite = scan && scan.reachable ? kit.leads.siteName(scan) : '';
    // The name the member knows the shop by (their Pipeline or what they typed), else the website's.
    const listed = lead.name && lead.name !== 'Open the map link' && !/^\[.*\]$/.test(lead.name) && !domainOf(lead.name) ? text.plain(lead.name) : '';
    const name = text.plain(input.business || listed || fromSite || 'Your shop');
    const link = reviewLink({ own: input.reviewLink, placeId: input.placeId || lead.placeId, mapsUrl: lead.mapsUrl, name, city });
    const copy = cardCopy({ name, visit: S.visit });
    const short = name.length > 28 ? name.split(/\s+/).slice(0, 3).join(' ') : name;
    const ask = {
      staff: S.staff,
      receipt: `Thanks for choosing ${short}! Tell us how we did on Google: [your review link]`,
      email: `Thank you for your ${S.visit} today. If you have a minute, would you tell others how it went? Leave us a Google review here: [your review link]`,
      text: `${short}: thanks for coming in today! Would you leave us a quick Google review? [your review link] Reply STOP to opt out.`,
    };
    const replies = {
      good: `Thank you, [first name]! We're glad you enjoyed your ${S.visit}. [One detail from their review.] See you next time. [Owner's first name], ${short}`,
      bad: `[First name], thank you for telling us, and I'm sorry your ${S.visit} wasn't what you expected. I'd like to make it right: please call me at [phone] or reply here. [Owner's first name], ${short}`,
    };
    const shown = !!(scan && scan.reachable && ((scan.reviewWidgets || []).length || scan.testimonials));
    const site = { checked: !!website, reachable: !!(scan && scan.reachable), shown, url: (scan && scan.url) || website, hex: scan && scan.colors && scan.colors.primary };
    const member = { name: text.plain(input.myName || br.firstName || ''), business: text.plain(input.myBusiness || br.name || ''), contact: text.plain(input.myContact || '') };
    const sample = !!(lead.source === 'sample' || lead.sample || (scan && scan.sample));
    const credit = kit.places.creditHtml(lead && lead.source ? [lead] : []);
    const html = kitHtml({ name, link, shop, copy, ask, replies, website: site, member, checked: day, sample, credit });
    const page = await save.saveFile(ctx, save.fileName(name, 'review-card-kit', '.html'), html);
    const svgText = cardPicture({ name, link, copy, checked: day, hex: site.hex });
    let picture = null;
    if (media.canRender(ctx)) {
      try {
        const png = await media.svgToPng(ctx, svgText, { width: 1080, height: 1350 });
        picture = await save.saveFile(ctx, save.fileName(name, 'review-card', '.png'), png, 'image/png');
      } catch (e) {
        picture = null;
      }
    }
    if (!picture) picture = await save.saveFile(ctx, save.fileName(name, 'review-card', '.svg'), svgText);
    const svc = NICHE.service;
    const me = member.name || '[your name]';
    const owner = scan && scan.reachable ? (kit.leads.ownerOf(scan) || {}).first || '' : '';
    const email = (scan && scan.reachable && scan.contacts && scan.contacts.emails && scan.contacts.emails[0]) || '';
    const phone = (scan && scan.reachable && scan.contacts && scan.contacts.phones && scan.contacts.phones[0]) || '';
    const address = text.plain(input.myAddress || '') || outreach.ADDRESS_HOLD;
    // The first email that offers the card (D28: name, business, mailing address, then the opt-out).
    const sendEmail = {
      subject: text.clip(text.fill(svc.subject, { biz: short }), 70),
      body: tidy([
        `Hi ${owner || 'there'},`,
        '',
        `I'm ${me}${member.business ? ` from ${member.business}` : ''}${city ? `, here in ${city.split(',')[0]}` : ''}. I made a free review card for ${short}: a counter card and handout cards with a QR code that opens your Google listing, so every customer can leave a review in one tap.`,
        '',
        site.checked && site.reachable && !shown ? `I also noticed your website doesn't show any reviews yet (I checked on ${day}).` : '',
        '',
        'The picture is attached. Want me to drop off printed cards this week?',
        '',
        me,
        ...(member.business ? [member.business] : []),
        address,
        '',
        outreach.OPT_OUT,
      ]),
    };
    let walkIn = `Hi, I'm ${me}. I made a free review card for ${short} with a code that opens your Google listing. Can I leave a few with you? It helps every customer leave a review before they forget.`;
    if (link.kind === 'own') {
      // A signed client: the handover, not the pitch.
      sendEmail.subject = `Your review cards for ${short} are ready`;
      sendEmail.body = tidy([
        `Hi ${owner || `${short} team`},`,
        '',
        'Your review card kit is attached. The codes open your own Google review link, and I tested them on two phones.',
        'Print the counter card on card stock and keep the handout cards at the register. Put the receipt line on every receipt, and have the team ask every customer the same way.',
        'One rule: ask everyone, and never offer anything for a review.',
        '',
        "I'll send you a reply draft for every new review within a day, and a one-page report at the end of the month.",
        '',
        me,
        ...(member.contact ? [member.contact] : []),
      ]);
      walkIn = `You're live! Every customer who scans the card lands on your review form. I'll send a reply draft for every new review within a day.`;
    }
    const listing = typeof lead.listing === 'string' ? lead.listing : '';
    return {
      name,
      shop,
      city,
      link,
      copy,
      ask,
      replies,
      page,
      picture,
      sendEmail,
      walkIn,
      sendCopy: input.sendCopy !== false,
      website: site,
      owner,
      email,
      phone,
      snapshot: listing,
      snapshotSource: lead.source || '',
      checked,
      sample,
      credited: !!credit,
      rules: NICHE.rules.map((r) => r.line),
    };
  },
  view(out) {
    const isPng = (f) => f && /png/.test(f.type || f.name || '');
    const send = out.sendCopy !== false;
    return views.blocks(
      out.sample ? views.text('Sample: a made-up shop on a .example site, so you can see what the kit looks like.') : null,
      views.metric(`Review card kit for ${out.name}`, out.link.kind === 'own' ? 'Own link' : 'Map link', out.link.note),
      out.snapshot ? views.text(`Rating snapshot today: ${out.snapshot}.${out.snapshotSource === 'google' ? ' From Google Maps; it stays in this run, so write it in the starting-point box by hand.' : ''}`) : views.text('Rating snapshot: open their listing and write the count, the stars and the newest review date in the starting-point box.'),
      views.image(isPng(out.picture) ? out.picture : null, 'Send this picture with your email or follow-up'),
      views.file(out.page, 'Review card kit (print-ready)'),
      !isPng(out.picture) ? views.file(out.picture, 'Card picture') : null,
      send ? views.copy(out.email ? `Email to send (to ${out.email})` : 'Email to send', `Subject: ${out.sendEmail.subject}\n\n${out.sendEmail.body}`) : null,
      send ? views.copy(out.link.kind === 'own' ? 'Go-live message' : 'Walk-in line', out.walkIn) : null,
      views.copy('What their team says', out.ask.staff),
      views.text(out.rules.join(' ')),
    );
  },
};
