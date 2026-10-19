// gym.before_after: the before-and-after card for one client gym, from one screenshot of its Reels tab
// (or the view counts typed in). Average views on the Reels before the member started, next to the
// first ones the member made. When views didn't go up there's no card, just the honest numbers for
// the owner. Proof, never a promise: nothing here tells a gym what views it will get.

const { READ_SCHEMA, READ_SYSTEM, compare, viewsFromRead, cardData, svgCard } = require('../lib/before-after');
const { accentFor } = require('../lib/scorecard');
const { saveCard } = require('../lib/render-card');
const { gymOf, whoFor, bankId, bankWith } = require('../lib/proof');
const { slug, plain } = require('../lib/util');
const { _loadImages: loadImages } = require('./read-profile');

const BEFORE = 10; // the same 10 Reels the "beat your views" promise counts
const fmt = (n) => Math.round(n).toLocaleString('en-US');

module.exports = {
  name: 'gym.before_after',
  title: 'Before-and-after card',
  description:
    "Makes a before-and-after card for a client gym from one screenshot of its Reels tab: average views on its Reels before you started, next to the first ones you made. Plus a message for the owner and a post for your own account. Anonymous unless the owner said yes. If views didn't go up, no card: the honest numbers instead.",
  kind: 'ai',
  risk: 'draft',
  needs: [],
  credits: 4,
  timeoutSec: 90,
  input: {
    type: 'object',
    properties: {
      gym: { type: 'object', title: 'Client gym', description: 'A gym from your Pipeline, or { name, category, city }' },
      screenshot: { type: 'string', format: 'asset', accept: 'image/*', title: 'One screenshot of their Reels tab', description: 'Scrolled so your Reels and at least 2 older ones show. JPG or PNG, under 5 MB.' },
      views: { type: 'array', title: 'Or type the views', description: 'Newest Reel first, pinned Reels left out', items: { type: 'integer', minimum: 0 }, maxItems: 30 },
      mine: { type: 'integer', title: 'How many of the newest Reels are yours', minimum: 1, maximum: 12, default: 4 },
      permission: { type: 'string', title: 'Can you name the gym?', description: "Only 'named' if the owner said yes in writing", enum: ['named', 'anonymous'], default: 'anonymous' },
      madeWith127: { type: 'boolean', title: 'Show "Made with 127"', default: true },
    },
    required: ['gym'],
  },
  output: {
    type: 'object',
    properties: { gym: { type: 'string' }, result: { type: 'object' }, image: { description: 'Null when views did not go up' }, owner: { type: 'string' }, note: { type: 'string' } },
    required: ['gym', 'result', 'owner', 'note'],
  },

  async run(input, ctx) {
    const row = input.gym && typeof input.gym === 'object' ? input.gym : {};
    const g = gymOf(row);
    if (!g.name) throw new Error('Pick a client gym first.');
    const mine = input.mine || 4;
    const brain = ctx.brain || {};

    // The views, newest first: typed in, or read from the screenshot.
    let views = Array.isArray(input.views) ? input.views.filter((v) => Number.isInteger(v) && v >= 0) : [];
    let unreadable = 0;
    if (views.length < mine + 2) {
      const images = await loadImages(ctx, input.screenshot ? [input.screenshot] : []);
      if (!images.length) throw new Error(views.length ? `Type at least ${mine + 2} view counts (your ${mine} and 2 older), or add a screenshot of their Reels tab.` : 'Add one screenshot of their Reels tab (JPG or PNG, under 5 MB), or type the views.');
      if (typeof ctx.ai !== 'function') throw new Error("Reading screenshots needs 127's AI, which isn't on here yet. Type the views instead.");
      const read = await ctx.ai({ task: 'vision', system: READ_SYSTEM, prompt: `This is ${g.name}'s Reels tab. List every Reel tile with its view count.`, images, schema: READ_SCHEMA, maxTokens: 900 });
      // A stand-in answer (no AI key on this server) read nothing, so it never blames the screenshot.
      if (read && read.sample) throw new Error("Reading screenshots needs 127's AI, which isn't on here yet. Type the views instead.");
      ({ views, unreadable } = viewsFromRead(read && read.data));
    }
    const result = compare(views, mine, { maxBefore: BEFORE });
    if (!result) throw new Error(`Found ${views.length} readable view count${views.length === 1 ? '' : 's'}. It takes your ${mine} newest and at least 2 older ones: scroll so both show, then take the screenshot again.`);

    const tz = (ctx.member && ctx.member.timezone) || 'America/Chicago';
    const now = ctx.now ? ctx.now() : Date.now();
    const date = new Date(now).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: tz });
    const member = ctx.member || {};
    const business = brain.business || {};
    const permission = input.permission === 'named' ? 'named' : 'anonymous';
    const hi = g.owner ? `Hi ${g.owner.name.split(/\s+/)[0]}` : `Hi ${g.name} team`;
    const nums = `your last ${result.before.n} Reels before we started averaged ${fmt(result.before.avg)} views, and the first ${result.after.n} we made average ${fmt(result.after.avg)}`;
    const warnings = [];
    if (unreadable) warnings.push(`${unreadable} Reel${unreadable > 1 ? 's' : ''} had a view count we couldn't read, so ${unreadable > 1 ? "they're" : "it's"} left out.`);
    if (result.before.n < BEFORE) warnings.push(`Only ${result.before.n} older Reels showed. Scroll a little further for the full ${BEFORE} next time.`);

    if (!result.up) {
      // No card for a result that isn't one. Say it first, before the owner notices.
      const owner = plain(`${hi}, a straight look at the Reels: ${nums}. Not where I want it yet. I'll show you what I'm changing on our next check-in.`);
      const note = plain(
        `No card this time: the first ${result.after.n} average ${fmt(result.after.avg)} views against ${fmt(result.before.avg)} before. Send the owner the numbers yourself before they notice. New Reels have also had the least time to collect views, so check again in 2 weeks.`
      );
      return { gym: g.name, result, image: null, png: false, owner, post: null, note, warnings };
    }

    const d = cardData({ gym: { name: g.name, category: g.category, city: g.city }, permission, result, date, member, business, madeWith127: input.madeWith127 !== false });
    const { image, png } = await saveCard(ctx, svgCard(d, { accent: accentFor(row) }), `before-after/${slug(g.name)}-${new Date(now).toISOString().slice(0, 10)}`);
    if (!png) warnings.push("Couldn't turn the card into an image here, so it's saved as an SVG.");
    const ask = permission === 'named' ? '' : ' Okay if I share it on my page? Without your name, or with it if you like.';
    const owner = plain(`${hi}, I counted from your Reels tab today: ${nums}. Card attached.${ask}`);
    const post = plain(
      `${d.who}: their last ${result.before.n} Reels averaged ${fmt(result.before.avg)} views. The first ${result.after.n} I made for them average ${fmt(result.after.avg)}. Counted from their Reels tab on ${date}. Run a gym? I'll make you one Reel free, no strings.`
    );
    const note = plain(
      `${d.big ? `${d.big} views per Reel` : 'More views per Reel'}. Use it in follow-ups, on calls and in proposals, never in a first message.${permission === 'named' ? '' : " It doesn't name the gym, so you can use it now. Named only once the owner says yes in writing."}`
    );
    // Into the proof bank, for follow-ups, calls and proposals (never a first message).
    if (typeof ctx.remember === 'function') {
      try {
        const line = `Average views per Reel up from ${fmt(result.before.avg)} to ${fmt(result.after.avg)} on the first ${result.after.n} Reels I made, for ${whoFor(g, permission === 'named')}.`;
        const entry = { id: bankId(g, 'ba'), month: new Date(now).toISOString().slice(0, 7), months: 1, permission, dmLine: null, proofPoints: [line] };
        await ctx.remember('proof_bank', bankWith(brain.packs && brain.packs.gym && brain.packs.gym.proof_bank, entry));
      } catch {
        // The card stands without it.
      }
    }
    if (ctx.log) ctx.log(plain(`Before and after for ${g.name}: ${fmt(result.before.avg)} to ${fmt(result.after.avg)} views per Reel`));
    return { gym: g.name, who: d.who, result, image, png, owner, post, note, warnings };
  },

  view(out) {
    const r = out.result;
    const blocks = [
      {
        type: 'metric',
        label: 'Views per Reel',
        value: `${fmt(r.before.avg)} to ${fmt(r.after.avg)}`,
        note: `their last ${r.before.n} before you, then your first ${r.after.n}${r.change != null ? ` (${r.change > 0 ? '+' : ''}${r.change}%)` : ''}`,
      },
    ];
    if (out.image && out.image.type === 'image/png') blocks.push({ type: 'image', asset: out.image, caption: out.who ? `${out.who}: before and after` : 'Before and after' });
    else if (out.image) blocks.push({ type: 'file', asset: out.image, label: 'The before-and-after card' });
    blocks.push({ type: 'text', text: [out.note, ...(out.warnings || [])].join('\n') });
    blocks.push({ type: 'copy', label: `To ${out.gym}'s owner${out.image ? ', with the card' : ''}`, text: out.owner });
    if (out.post) blocks.push({ type: 'copy', label: 'Post for your own account, with the card', text: out.post });
    return blocks;
  },
};
