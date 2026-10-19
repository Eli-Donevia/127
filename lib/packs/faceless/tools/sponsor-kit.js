// A sponsor pitch from numbers the member types (nothing is guessed or looked up): a one-page media
// kit (a page to print or attach, and the same kit as a picture), the pitch email and a follow-up,
// and how YouTube, TikTok and the FTC say a paid video must be labelled. With a brand named, the
// pitch goes in the Pipeline so Do my day hands it out and reminds about the follow-up.

const { ai, views, save, text, time, brain, media, outreach } = require('../../_kit');
const C = require('../lib/channel');
const P = require('../lib/pages');
const S = require('../lib/script');

const FORMATS = [
  'A short made about your product, with your link in the description',
  'A mention near the start of one of my regular shorts, said out loud and shown on screen',
  'Your link pinned in the comments',
];

const PITCH = {
  type: 'object',
  properties: { subject: { type: 'string' }, opener: { type: 'string' }, pitch: { type: 'string' }, ask: { type: 'string' } },
  required: ['subject', 'opener', 'pitch', 'ask'],
};

const int = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 && v !== '' && v != null ? Math.round(Number(v)) : null);
const usd = (v) => `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: Number(v) % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const lowerFirst = (s) => String(s || '').charAt(0).toLowerCase() + String(s || '').slice(1);

// The numbers the member typed, as kit tiles and one plain sentence.
function numbersOf(input) {
  const n = {
    views28: int(input.views28),
    avgViews: int(input.avgViews),
    videos28: int(input.videos28),
    youtubeSubs: int(input.youtubeSubs),
    tiktokFollowers: int(input.tiktokFollowers),
  };
  const tiles = [
    n.views28 != null && { label: 'Views in the last 28 days', value: n.views28 },
    n.avgViews != null && { label: 'Average views per video', value: n.avgViews },
    n.youtubeSubs != null && { label: 'YouTube subscribers', value: n.youtubeSubs },
    n.tiktokFollowers != null && { label: 'TikTok followers', value: n.tiktokFollowers },
    n.videos28 != null && { label: 'Videos in the last 28 days', value: n.videos28 },
  ].filter(Boolean);
  const parts = [];
  if (n.views28 != null) parts.push(`In the last 28 days my videos had ${P.fmt(n.views28)} views${n.avgViews != null ? `, about ${P.fmt(n.avgViews)} a video` : ''}.`);
  else if (n.avgViews != null) parts.push(`My videos average ${P.fmt(n.avgViews)} views each.`);
  const follow = [n.youtubeSubs != null ? `${P.fmt(n.youtubeSubs)} subscribers on YouTube` : '', n.tiktokFollowers != null ? `${P.fmt(n.tiktokFollowers)} followers on TikTok` : ''].filter(Boolean);
  if (follow.length) parts.push(`The channel has ${follow.join(' and ')}.`);
  if (n.videos28 != null) parts.push(`I post about ${P.fmt(n.videos28)} videos every 28 days.`);
  const sources = [n.youtubeSubs != null || n.views28 != null || n.avgViews != null || n.videos28 != null ? 'YouTube Studio' : '', n.tiktokFollowers != null ? 'TikTok Studio' : ''].filter(Boolean).join(' and ') || 'your analytics';
  return { n, tiles, sentence: parts.join(' '), sources };
}

module.exports = {
  name: 'faceless.sponsor_kit',
  title: 'Make a sponsor pitch',
  description: 'Makes a one-page media kit from the numbers you type (a page and a picture), a pitch email and a follow-up for the brand you name, and how YouTube, TikTok and the FTC say a paid video must be labelled. Nothing is guessed: no numbers you did not type, no suggested prices.',
  kind: 'ai',
  risk: 'draft',
  needs: [],
  wants: ['render'],
  tasks: ['write'],
  credits: 6,
  timeoutSec: 180,
  input: {
    type: 'object',
    properties: {
      brand: { type: 'string', title: 'Brand to pitch (optional)', maxLength: 80 },
      contact: { type: 'string', title: 'Their first name (optional)', maxLength: 40 },
      contactEmail: { type: 'string', title: 'Their email (optional)', maxLength: 120 },
      product: { type: 'string', title: 'What they sell (optional)', maxLength: 120 },
      fit: { type: 'string', title: 'Why your viewers would care (optional)', maxLength: 240 },
      channel: { type: 'string', title: 'Channel name', maxLength: 80 },
      about: { type: 'string', title: 'What the channel posts', maxLength: 160 },
      youtubeSubs: { type: 'integer', title: 'YouTube subscribers', minimum: 0 },
      tiktokFollowers: { type: 'integer', title: 'TikTok followers', minimum: 0 },
      views28: { type: 'integer', title: 'Views in the last 28 days', minimum: 0 },
      avgViews: { type: 'integer', title: 'Average views per video, last 28 days', minimum: 0 },
      videos28: { type: 'integer', title: 'Videos posted in the last 28 days', minimum: 0 },
      audience: { type: 'string', title: 'Who watches (optional)', maxLength: 160 },
      countries: { type: 'string', title: 'Top countries (optional)', maxLength: 120 },
      rate: { type: 'number', title: 'Your price for one sponsored video, in dollars (optional)', minimum: 0 },
      formats: { type: 'string', title: 'Ways to work together, one per line (optional)', maxLength: 800 },
      email: { type: 'string', title: 'Your email for the kit', maxLength: 120 },
      asOf: { type: 'string', format: 'date', title: 'Numbers as of (optional)' },
    },
  },
  output: {
    type: 'object',
    properties: {
      kit: { type: 'object' },
      page: { type: ['object', 'null'] },
      picture: { type: ['object', 'null'] },
      subject: { type: 'string' },
      email: { type: 'string' },
      followUp: { type: 'string' },
      checklist: { type: 'array' },
      lead: { type: ['string', 'null'] },
      notes: { type: 'array' },
      ai: { type: 'boolean' },
      sample: { type: 'boolean' },
    },
    required: ['kit', 'email'],
  },
  async run(input, ctx) {
    const b = brain.brainOf(ctx, input);
    const n = C.nicheFor(ctx, input.niche);
    const notes = [];
    const channel = text.oneLine(input.channel || b.name) || '[your channel name]';
    const about = text.oneLine(input.about || b.what) || `${n.label.toLowerCase()} shorts`;
    const nums = numbersOf(input);
    const today = time.today(ctx);
    const asOf = /^\d{4}-\d{2}-\d{2}$/.test(String(input.asOf || '')) ? input.asOf : today;
    const formats = String(input.formats || '').split(/\r?\n/).map((f) => text.oneLine(f)).filter(Boolean);
    const rate = Number(input.rate) > 0 ? Number(input.rate) : null;
    const handles = [b.youtube && { label: 'YouTube', value: /^https?:/.test(b.youtube) ? b.youtube.replace(/^https?:\/\/(www\.)?/, '') : `@${b.youtube.replace(/^@/, '')}` }, b.tiktok && { label: 'TikTok', value: `@${b.tiktok}` }, b.instagram && { label: 'Instagram', value: `@${b.instagram}` }].filter(Boolean);
    const brand = text.oneLine(input.brand || '');
    const kit = {
      channel,
      about: text.sentenceCase(about),
      handles,
      numbers: nums.tiles,
      sources: nums.sources,
      audience: text.oneLine(input.audience || ''),
      countries: text.oneLine(input.countries || ''),
      formats: formats.length ? formats : FORMATS,
      rate,
      packages: rate ? [{ label: 'One sponsored video', price: usd(rate) }, { label: `Three sponsored videos (3 x ${usd(rate)})`, price: usd(rate * 3) }] : [],
      email: text.oneLine(input.email || ''),
      asOf,
      accent: C.videoColor(ctx, n),
    };
    if (!nums.tiles.length) notes.push('Add your numbers from YouTube Studio or TikTok Studio: brands ask for views first. The kit leaves a gap for them until you do.');
    if (!kit.email) notes.push('Add your business email so brands can answer you. The kit says [your email] until you do.');
    if (channel.startsWith('[')) notes.push('Add your channel name in Your business, or type it here.');

    // The email: the middle written from the typed facts only; greeting and footer are ours.
    const facts = [channel, about, nums.sentence, brand, input.product, input.fit, rate ? usd(rate) : '', kit.audience, kit.countries].filter(Boolean).join('. ');
    const fallback = () => ({
      subject: brand ? `A sponsored short for ${brand}` : `Sponsoring ${channel}`,
      opener: `I make ${lowerFirst(about.replace(/[.!]+$/, ''))} on ${channel}. ${nums.sentence}`.trim(),
      pitch: `${input.fit ? `${text.sentenceCase(text.oneLine(input.fit).replace(/[.!]+$/, ''))}. ` : ''}I'd like to make a sponsored short for ${brand || 'your brand'}${input.product ? ` about ${lowerFirst(text.oneLine(input.product))}` : ''}. Every sponsored video says so out loud and on screen, and is labelled as paid promotion on YouTube and branded content on TikTok.${rate ? ` My rate is ${usd(rate)} a video.` : ''}`,
      ask: 'My one-page media kit is attached. Would you be open to it? I can send a sample script first.',
    });
    const { data, ai: viaAi } = await ai.aiJson(ctx, {
      task: 'write',
      system: 'You write short, friendly sponsorship pitches from small faceless video creators to brands. Plain words, no hype, no promises of sales, reach or results.',
      prompt: [
        `Write the pitch email${brand ? ` to ${brand}` : ''} in 90 to 140 words. Use only these facts and never add a number:`,
        `Channel: ${channel}. What it posts: ${about}.`,
        nums.sentence ? `Numbers: ${nums.sentence}` : 'No numbers given: mention none.',
        input.product ? `What the brand sells: ${input.product}` : '',
        input.fit ? `Why viewers would care: ${input.fit}` : '',
        rate ? `Rate: ${usd(rate)} a video` : 'No rate given: mention none.',
        'Say every sponsored video is labelled as an ad and says so out loud.',
        'Return subject (under 60 characters), opener (who they are and the numbers, 1 to 2 sentences), pitch (the idea for the brand, 2 to 3 sentences) and ask (one or two sentences: the media kit is attached, and a question).',
      ].filter(Boolean).join('\n'),
      schema: PITCH,
      maxTokens: 700,
      fallback,
      accept: (d) => ai.cleanCopy(d) && S.unknownNumbers(`${d.subject} ${d.opener} ${d.pitch} ${d.ask}`, facts).length === 0 && (!rate || `${d.pitch} ${d.ask} ${d.opener}`.includes(usd(rate).replace('$', ''))),
    });
    const hi = text.oneLine(input.contact || '') || (brand ? `${brand} team` : '[first name]');
    const me = b.firstName || '[your name]';
    const sign = [me, channel.startsWith('[') ? '' : channel, b.address || outreach.ADDRESS_HOLD].filter(Boolean).join('\n');
    const optOut = outreach.optOut('sponsoring my channel');
    const email = [`Hi ${hi},`, '', data.opener, '', data.pitch, '', data.ask, '', sign, '', optOut].join('\n');
    const follow = `Hi ${hi},\n\nJust checking you saw my note about a sponsored short for ${brand || 'your brand'} on ${channel}. I'm glad to send a sample script first.\n\n${me}`;
    const followUp = `${follow}\n${[channel.startsWith('[') ? '' : channel, b.address || outreach.ADDRESS_HOLD].filter(Boolean).join('\n')}\n\n${optOut}`;
    const checklist = C.RULES.sponsors.map((x) => ({ title: x.title, text: x.text, url: x.url }));

    const base = save.fileName(channel.startsWith('[') ? 'channel' : channel, 'media kit', asOf);
    const page = await save.saveFile(ctx, `${base}.html`, P.mediaKitHtml(kit));
    let picture = null;
    if (media.canRender(ctx)) {
      const pic = P.mediaKitSvg(kit);
      picture = await save.saveFile(ctx, `${base}.png`, await media.svgToPng(ctx, pic.svg, { width: pic.W, height: pic.H }));
    }
    let lead = null;
    if (brand && ctx.leads && typeof ctx.leads.upsert === 'function') {
      try {
        const saved = await ctx.leads.upsert({
          key: `sponsor:${text.slug(brand, 60)}`,
          name: brand,
          company: brand,
          stage: 'found',
          channel: 'email',
          score: 50,
          facts: [input.fit ? `Fit: ${text.clip(input.fit, 100)}` : '', input.product ? `They sell ${text.clip(input.product, 90)}` : ''].filter(Boolean),
          links: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(input.contactEmail || '').trim()) ? { email: String(input.contactEmail).trim() } : {},
          msg: { subject: data.subject, email, follow1: follow },
          note: `Sponsor pitch for ${channel}`,
          data: { kind: 'sponsor', rate },
        });
        lead = saved && saved.id ? String(saved.id) : null;
      } catch (e) {
        ctx.log(`Couldn't add ${brand} to the Pipeline: ${String(e.message).slice(0, 80)}`);
      }
    }
    ctx.log(`Media kit for ${channel} with ${nums.tiles.length} numbers${rate ? ` and a rate of ${usd(rate)}` : ''}${brand ? `, pitch for ${brand}` : ''}${lead ? ' (in your Pipeline)' : ''}`);
    return { kit, page, picture, subject: data.subject, email, followUp, checklist, lead, notes, ai: viaAi, sample: !viaAi };
  },
  view(out) {
    return views.blocks(
      views.image(out.picture, 'Your media kit, to attach'),
      views.file(out.page, 'Media kit page (print it or save it as a PDF)'),
      (out.notes || []).map((x) => views.text(x)),
      views.copy(`Pitch email: ${out.subject}`, out.email, { subject: out.subject }),
      views.copy('Follow-up, 5 days later if they have not answered', out.followUp),
      out.lead ? views.text('The pitch is in your Pipeline, so Do my day hands it to you and reminds you about the follow-up.') : null,
      views.text('Before you post a paid video:'),
      views.cards(out.checklist.map((c) => ({ title: c.title, body: c.text, href: c.url }))),
      views.text('Sponsored videos don\'t earn from TikTok\'s Creator Rewards. Numbers in the kit are the ones you typed, dated, so check them against your Studio on the day you send it.'),
    );
  },
};
