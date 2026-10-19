// gym.read_profile: the no-API way to check a gym's Instagram. The member opens the gym's profile
// on their phone and adds up to 4 screenshots (the profile with its grid, the Reels tab, the newest
// post). AI reads only what is on screen; anything not visible comes back null, never guessed.
// Images are read in memory and not stored (same rule as HQ's screenshot drop-in).

const fs = require('fs');
const { scoreGym } = require('../lib/score');

const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_BYTES = 5 * 1024 * 1024;

// Up to 4 images: files from the member's Library (what HQ's file input gives, contract v1.2 4b), or
// data URLs from the AI link and older runs. Anything else, too big or not an image is skipped.
async function loadImages(ctx, list) {
  const out = [];
  for (const item of [].concat(list || []).slice(0, 4)) {
    const s = String(item || '');
    const m = s.match(/^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/);
    if (m) {
      if (TYPES.includes(m[1]) && Buffer.byteLength(m[2], 'base64') <= MAX_BYTES) out.push({ type: m[1], data: m[2] });
      continue;
    }
    if (!s || !ctx || typeof ctx.asset !== 'function') continue;
    try {
      const a = await ctx.asset(s);
      if (!a || !a.path || !TYPES.includes(a.type)) continue;
      const buf = fs.readFileSync(a.path);
      if (buf.length <= MAX_BYTES) out.push({ type: a.type, data: buf.toString('base64') });
    } catch {
      /* not one of the member's files, or unreadable: skipped */
    }
  }
  return out;
}

const SCHEMA = {
  type: 'object',
  properties: {
    platform: { type: 'string', enum: ['instagram', 'tiktok', 'other'] },
    handle: { type: ['string', 'null'] },
    followers: { type: ['integer', 'null'] },
    posts: { type: ['integer', 'null'] },
    newest_post_date: { type: ['string', 'null'], description: 'YYYY-MM-DD only if a date is visible on screen' },
    tiles_seen: { type: 'integer', description: 'How many grid tiles are visible' },
    reels_tiles: { type: 'integer', description: 'Visible tiles marked as Reels or video' },
    reel_views: { type: 'array', items: { type: 'integer' }, description: 'View counts printed on Reels, in order' },
    flyer_tiles: { type: 'integer', description: 'Tiles that are text-heavy graphics or flyers' },
    people_tiles: { type: 'integer', description: 'Tiles that show real people training or coaching' },
    bio_offer: { type: ['string', 'null'], description: 'An offer in the bio, quoted' },
    bio_link: { type: 'boolean' },
    themes: { type: 'array', items: { type: 'string' }, maxItems: 6 },
    notes: { type: 'array', items: { type: 'string' }, maxItems: 4, description: 'Short, factual observations about the content quality' },
  },
  required: ['platform', 'tiles_seen', 'reels_tiles', 'reel_views', 'flyer_tiles', 'people_tiles', 'bio_link', 'themes', 'notes'],
};

const SYSTEM = `You read screenshots of a gym's social media profile for a video editor who wants to pitch them.
Report only what is visible. If a number or date is not on screen, use null. Never estimate follower counts, dates or views.
"1.2K" means 1200 and "3.4M" means 3400000. Count tiles carefully. Notes are short and factual, about what the content looks like (lighting, faces, text-heavy flyers, consistent branding, hooks), never insults.`;

function median(a) {
  const s = a.filter(Number.isFinite).sort((x, y) => x - y);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

module.exports = {
  name: 'gym.read_profile',
  title: "Check a gym's Instagram",
  description:
    "Reads screenshots of a gym's Instagram or TikTok profile (the grid, the Reels tab, the newest post) and returns what is visible: followers, posts, how many are Reels, view counts, when they last posted, and notes on the content.",
  kind: 'ai',
  risk: 'read',
  needs: [],
  credits: 6,
  input: {
    type: 'object',
    properties: {
      gym: { type: 'object', title: 'Gym' },
      screenshots: { type: 'array', title: 'Screenshots', description: 'Up to 4: the profile with its grid, the Reels tab, the newest post', items: { type: 'string', format: 'asset' }, accept: 'image/*', maxItems: 4 },
    },
    required: ['gym', 'screenshots'],
  },
  output: { type: 'object', properties: { content: { type: 'object' }, score: { type: 'object' } }, required: ['content'] },

  async run(input, ctx) {
    const images = await loadImages(ctx, input.screenshots);
    if (!images.length) throw new Error('Add a screenshot of their profile first (JPG or PNG, under 5 MB).');
    if (typeof ctx.ai !== 'function') throw new Error("Reading screenshots needs 127's AI, which isn't on here yet.");
    const name = (input.gym && input.gym.name) || 'this gym';
    const { data, sample } = await ctx.ai({
      task: 'vision',
      system: SYSTEM,
      prompt: `These are screenshots of ${name}'s profile. Fill in the fields.`,
      images,
      schema: SCHEMA,
      maxTokens: 900,
    });
    // A stand-in answer (no AI key on this server) would be made-up numbers, never a reading.
    if (sample) throw new Error("Reading screenshots needs 127's AI, which isn't on here yet.");
    if (!data) throw new Error("Couldn't read those screenshots. Try one of the profile page with the grid showing.");
    const nowMs = ctx.now ? ctx.now() : Date.now();
    const newest = data.newest_post_date && /^\d{4}-\d{2}-\d{2}$/.test(data.newest_post_date) ? Date.parse(`${data.newest_post_date}T12:00:00Z`) : null;
    const views = median(data.reel_views || []);
    const content = {
      source: 'screenshot',
      platform: data.platform,
      handle: data.handle ? String(data.handle).replace(/^@/, '') : (input.gym && input.gym.instagram) || null,
      followers: Number.isFinite(data.followers) ? data.followers : null,
      posts: Number.isFinite(data.posts) ? data.posts : null,
      sampled: data.tiles_seen || 0,
      daysSinceLastPost: newest && newest <= nowMs ? Math.floor((nowMs - newest) / 864e5) : null,
      postsPerWeek: null,
      reelsShare: data.tiles_seen ? Math.round((data.reels_tiles / data.tiles_seen) * 100) / 100 : null,
      medianViews: views,
      viewsToFollowers: views != null && data.followers ? Math.round((views / data.followers) * 100) / 100 : null,
      engagementRate: null,
      flyerShare: data.tiles_seen ? Math.round((data.flyer_tiles / data.tiles_seen) * 100) / 100 : null,
      peopleShare: data.tiles_seen ? Math.round((data.people_tiles / data.tiles_seen) * 100) / 100 : null,
      bioOffer: data.bio_offer || null,
      themes: data.themes || [],
      notes: data.notes || [],
    };
    // A score needs what the gym's website showed too, so it's left out when there's no site.
    return input.gym && input.site ? { content, score: scoreGym(input.gym, input.site, content) } : { content };
  },

  view(out) {
    const c = out.content;
    const facts = [
      c.followers != null && `${c.followers} followers`,
      c.reelsShare != null && `${Math.round(c.reelsShare * 100)}% of visible posts are Reels`,
      c.medianViews != null && `Reels get about ${c.medianViews} views`,
      c.daysSinceLastPost != null && `last post ${c.daysSinceLastPost} days ago`,
      c.flyerShare != null && c.flyerShare > 0.3 && `${Math.round(c.flyerShare * 100)}% flyers or text graphics`,
    ].filter(Boolean);
    return [{ type: 'text', text: [`@${c.handle || 'profile'}: ${facts.join(', ')}.`, ...c.notes].join('\n') }];
  },

  _loadImages: loadImages,
};
