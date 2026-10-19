// gym.spec_video: a 15-second vertical sample Reel made for one gym, from its own name, colors,
// logo, real offer and website photos (or the member's clips). The member sends it privately to the
// owner as the pitch. Marked SAMPLE, never posted. Rendered with ffmpeg (no npm packages).

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { shortSite, slug, plain, getText } = require('../lib/util');
const { OFFER_LABEL } = require('../lib/gaps');
const { isBrandish, hexToRgb } = require('../lib/site-scan');

let video;
function renderer() {
  if (!video) video = require('../lib/video/render');
  return video;
}

const PALETTE = {
  gym: ['#e4002b', '#111111'],
  crossfit: ['#ff5a1f', '#0d0d0d'],
  yoga: ['#7c9a7e', '#1c2420'],
  pilates: ['#e9c2b0', '#2b1b17'],
  boxing: ['#d4af37', '#0b0b0b'],
  martial_arts: ['#b3121b', '#0e0e0e'],
  climbing: ['#ff8a00', '#101418'],
  cycling: ['#7a5cff', '#0b0b14'],
  dance: ['#ff3d8b', '#140b12'],
};

// Motivational, not factual: nothing here claims something about this gym that could be untrue.
const SCRIPT = {
  gym: { hook: 'Never stepped in a gym?', lines: ['Show up as you are', 'Leave stronger than you came', 'Same time next week?'] },
  crossfit: { hook: "Think CrossFit isn't for you?", lines: ['Every workout scales to you', 'Cheered on to the last rep', 'Your first PR is closer than you think'] },
  yoga: { hook: 'Need an hour that is just yours?', lines: ['Breathe out the week', 'Every body, every level', 'Roll out the mat'] },
  pilates: { hook: 'Never tried a reformer?', lines: ['Slow, controlled, strong', 'Breathe, brace, hold', 'You will feel it tomorrow'] },
  boxing: { hook: 'Bad day? Hit something.', lines: ['Wrap up', 'Learn the combo', 'Leave it on the bag'] },
  martial_arts: { hook: 'Always wanted to try it?', lines: ['Day one is a white belt', 'Discipline you can feel', 'Bow in'] },
  climbing: { hook: 'Never climbed before?', lines: ['Shoes on, chalk up', 'One more move', 'Top out'] },
  cycling: { hook: 'Wait for the drop.', lines: ['Lights down', 'Music up', 'Ride it out'] },
  dance: { hook: 'Two left feet? Perfect.', lines: ['Learn it slow', 'Then full speed', 'Then own it'] },
};
// The parts of a class, without clock times: we don't know when the gym's classes run, and a
// sample that says "6AM class" to a gym with no 6AM class reads as made up.
const SCHEDULE = {
  crossfit: [{ label: 'Warm-up' }, { label: 'Skill' }, { label: 'WOD' }, { label: 'High fives' }],
  cycling: [{ label: 'Clip in' }, { label: 'Climb' }, { label: 'Sprint' }, { label: 'Cool down' }],
  default: [{ label: 'Warm-up' }, { label: 'Strength' }, { label: 'Finisher' }, { label: 'High fives' }],
};

function run(cmd, args, { signal } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const out = [];
    const err = [];
    p.stdout.on('data', (d) => out.push(d));
    p.stderr.on('data', (d) => err.push(d));
    const kill = () => p.kill('SIGKILL');
    if (signal) signal.addEventListener('abort', kill, { once: true });
    p.on('error', reject);
    p.on('close', (code) => {
      if (signal) signal.removeEventListener('abort', kill);
      if (code === 0) resolve(Buffer.concat(out));
      else reject(new Error(Buffer.concat(err).toString().slice(-400)));
    });
  });
}

async function download(ctx, url, dir, name, maxBytes = 8e6) {
  try {
    const res = await ctx.fetch(url, { redirect: 'follow', signal: ctx.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; 127-gym-pack/0.1; +https://127group.io)' } });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > maxBytes) return null;
    const ext = (url.match(/\.(png|jpe?g|webp|svg|ico|gif|mp4|mov|webm)(\?|$)/i) || [])[1] || 'bin';
    const file = path.join(dir, `${name}.${ext.toLowerCase()}`);
    fs.writeFileSync(file, buf);
    return file;
  } catch {
    return null;
  }
}

// Any image ffmpeg can read -> PNG (logos keep transparency). Returns null if unreadable or tiny.
async function toPng(file, out, { minSide = 0, max = 1080, signal } = {}) {
  try {
    const probe = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { signal });
    const [w, h] = String(probe).trim().split(',').map(Number);
    if (!w || !h || Math.min(w, h) < minSide) return null;
    await run('ffmpeg', ['-y', '-v', 'error', '-i', file, '-frames:v', '1', '-vf', `scale='min(${max},iw)':-2`, out], { signal });
    return fs.existsSync(out) ? out : null;
  } catch {
    return null;
  }
}

// The logo's main color, if it has one (ignores transparent, white, black and grey pixels).
async function logoColor(png, signal) {
  try {
    const raw = await run('ffmpeg', ['-v', 'error', '-i', png, '-vf', 'scale=24:24', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], { signal });
    const counts = new Map();
    for (let i = 0; i + 3 < raw.length; i += 4) {
      if (raw[i + 3] < 128) continue;
      const q = [raw[i], raw[i + 1], raw[i + 2]].map((v) => Math.min(255, Math.round(v / 24) * 24));
      const hex = `#${q.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
      if (!isBrandish(hex)) continue;
      counts.set(hex, (counts.get(hex) || 0) + 1);
    }
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return best && best[1] >= 12 ? best[0] : null;
  } catch {
    return null;
  }
}

function offerCard(site) {
  const o = site && site.offer;
  const where = site && site.url ? `Book at ${shortSite(site.url)}` : 'DM us to book';
  if (!o || o.kind === 'none' || !o.text) return { headline: 'Come try a class', sub: where, real: false };
  const t = o.text.replace(/\s+/g, ' ').trim();
  const headline = o.kind === 'free_class' && !/first|free/i.test(t.slice(0, 6)) ? 'Your first class is free' : t.charAt(0).toUpperCase() + t.slice(1);
  return { headline: headline.length > 34 ? `${OFFER_LABEL[o.kind] || 'Intro offer'}` : headline, sub: where, real: true };
}

const SCRIPT_SCHEMA = {
  type: 'object',
  properties: { hook: { type: 'string', maxLength: 40 }, lines: { type: 'array', items: { type: 'string', maxLength: 34 }, minItems: 3, maxItems: 3 } },
  required: ['hook', 'lines'],
};

async function aiScript(ctx, row, base) {
  if (typeof ctx.ai !== 'function') return null;
  try {
    const { data } = await ctx.ai({
      task: 'write',
      system:
        'You write on-screen text for a 15-second vertical promo video for a local gym. A hook of at most 6 words, then exactly 3 short lines of at most 6 words each. Motivational and concrete. Never state facts about the gym (no "best", no numbers, no awards, no results, no prices). No emojis, no hashtags, no em dashes.',
      prompt: `Gym: ${row.gym.name}, a ${row.gym.category.replace('_', ' ')} gym. What it is missing: ${(row.gaps || []).map((g) => g.title).join('; ') || 'unknown'}. Video ideas: ${(row.ideas || []).map((i) => i.title).join('; ')}. Default hook: "${base.hook}".`,
      schema: SCRIPT_SCHEMA,
      maxTokens: 300,
    });
    if (data && data.hook && Array.isArray(data.lines) && data.lines.length >= 2) return { hook: plain(data.hook), lines: data.lines.slice(0, 3).map(plain) };
  } catch {
    /* fall back to the built-in script */
  }
  return null;
}

module.exports = {
  name: 'gym.spec_video',
  title: 'Make a sample Reel',
  description:
    "Makes a 15-second vertical sample Reel for one gym from its name, colors, logo, real offer and website photos (or your own clips), marked SAMPLE. You send it privately to the owner as your pitch.",
  kind: 'code',
  risk: 'draft',
  needs: ['render'],
  credits: 8,
  timeoutSec: 300,
  input: {
    type: 'object',
    properties: {
      gym: { type: 'object', title: 'Gym', description: 'One ranked gym from gym.find_gaps' },
      template: { type: 'string', title: 'Style', enum: ['auto', 'offer', 'class', 'hype'], default: 'auto' },
      clips: { type: 'array', title: 'Your clips (optional)', description: 'Files from your Library or https links to MP4s', items: {} },
      hook: { type: 'string', title: 'First line (optional)', maxLength: 40 },
      lines: { type: 'array', title: 'Three short lines (optional)', items: { type: 'string', maxLength: 34 } },
      usePhotos: { type: 'boolean', title: "Use photos from the gym's website", default: true },
    },
    required: ['gym'],
  },
  output: { type: 'object', properties: { video: { type: 'object' }, poster: { type: 'object' }, template: { type: 'string' }, script: { type: 'object' } }, required: ['video'] },

  async run(input, ctx) {
    const row = input.gym && input.gym.gym ? input.gym : { gym: input.gym || {}, site: (input.gym && input.gym.site) || null };
    const gym = row.gym;
    if (!gym.name) throw new Error('Pick a gym first.');
    const site = row.site && row.site.reachable ? row.site : null;
    const dir = ctx.tmpdir();
    const warnings = [];

    // Logo and colors
    let logo = null;
    const logoUrl = site && (site.images.logo || site.images.icon);
    if (logoUrl && !ctx.sample) {
      const f = await download(ctx, logoUrl, dir, 'logo-src', 3e6);
      if (f) logo = await toPng(f, path.join(dir, 'logo.png'), { minSide: 48, max: 600, signal: ctx.signal });
    }
    let primary = site && site.colors && site.colors.primary;
    let accent = site && site.colors && site.colors.accent;
    if (!primary && logo) primary = await logoColor(logo, ctx.signal);
    const pal = PALETTE[gym.category] || PALETTE.gym;
    if (!primary) {
      primary = pal[0];
      warnings.push("Couldn't find the gym's brand color, so it uses a default. Change it if you know theirs.");
    }
    if (!accent || !hexToRgb(accent)) accent = pal[1];

    // Footage: the member's clips first, else the gym's own website photos.
    const clips = [];
    for (const c of [].concat(input.clips || []).slice(0, 8)) {
      let p = null;
      if (c && typeof c === 'object' && typeof ctx.file === 'function') p = await ctx.file(c);
      else if (typeof c === 'string' && /^https:\/\//i.test(c)) p = await download(ctx, c, dir, `clip-${clips.length}`, 80e6);
      else if (typeof c === 'string' && fs.existsSync(c)) p = path.resolve(c);
      if (p) clips.push(p);
    }
    const photos = [];
    if (!clips.length && input.usePhotos !== false && site && !ctx.sample) {
      for (const [i, u] of (site.images.photos || []).slice(0, 6).entries()) {
        if (photos.length >= 4) break;
        const f = await download(ctx, u, dir, `photo-src-${i}`, 6e6);
        const png = f && (await toPng(f, path.join(dir, `photo-${i}.jpg`), { minSide: 500, max: 1600, signal: ctx.signal }));
        if (png) photos.push(png);
      }
    }

    // Words
    const base = SCRIPT[gym.category] || SCRIPT.gym;
    // Sample mode skips AI: its stand-in answers would end up on screen.
    const ai = input.hook || (input.lines && input.lines.length) || ctx.sample ? null : await aiScript(ctx, row, base);
    const hook = plain(input.hook || (ai && ai.hook) || base.hook);
    const lines = (input.lines && input.lines.length ? input.lines : (ai && ai.lines) || base.lines).slice(0, 3).map(plain);
    const offer = offerCard(site);
    // The gym's own intro offer, when its site shows one: the sample is an ad for it. Otherwise a
    // Reel of what a class feels like (with their photos or the member's clips), or a type-only one.
    const template = input.template && input.template !== 'auto' ? input.template : offer.real ? 'offer' : clips.length || photos.length >= 2 ? 'class' : 'hype';

    const props = {
      template,
      gym: { name: gym.name.replace(/\s*\(\d+ locations\)$/, ''), city: gym.city || '', site: site ? shortSite(site.url) : '', category: gym.category, colors: { primary, accent }, logo: logo || undefined },
      hook,
      lines,
      offer: { headline: offer.headline, sub: offer.sub },
      cta: offer.sub,
      schedule: SCHEDULE[gym.category] || SCHEDULE.default,
      clips,
      photos,
      beat: false,
      watermark: `SAMPLE · made for ${gym.name.replace(/\s*\(\d+ locations\)$/, '')}${ctx.member && ctx.member.firstName ? ` by ${ctx.member.firstName}` : ''}`,
    };
    if (ctx.log) ctx.log(`Making a ${template} sample for ${props.gym.name}`);
    const outPath = path.join(dir, `${slug(props.gym.name)}-${template}.mp4`);
    const res = await renderer().renderSpecReel(props, { outPath, tmpDir: dir, signal: ctx.signal });
    const name = `samples/${slug(props.gym.name)}-${template}`;
    const videoAsset = await ctx.save(`${name}.mp4`, fs.readFileSync(res.video), { type: 'video/mp4' });
    const posterAsset = res.poster && fs.existsSync(res.poster) ? await ctx.save(`${name}.png`, fs.readFileSync(res.poster), { type: 'image/png' }) : null;
    if (!offer.real) warnings.push("No offer found on their site, so the video says \"Come try a class\". Swap in their real offer if they have one.");
    return {
      video: videoAsset,
      poster: posterAsset,
      template,
      realOffer: !!offer.real,
      script: { hook, lines, offer: offer.headline, cta: offer.sub, aiWritten: !!ai },
      colors: { primary, accent },
      used: { logo: !!logo, photos: photos.length, clips: clips.length },
      caption: plain(`${hook} ${lines[0] ? `${lines[0]}.` : ''} ${offer.headline}. ${offer.sub}.`).replace(/\.\./g, '.'),
      // The renderer's no-footage note, said the way a member can act on it.
      warnings: warnings.concat((res.warnings || []).map((w) => (/^No clips or photos/.test(w) ? 'Their website had no photos we could use, so this sample is their name, colors and offer in motion. If you have clips of their gym, add them for a stronger one.' : w))),
      sample: !!ctx.sample,
    };
  },

  view(out) {
    return [
      { type: 'video', asset: out.video, caption: `Sample for the owner only. Don't post it. ${out.script.hook}` },
      { type: 'copy', label: 'Caption they could post with it', text: out.caption },
      ...(out.warnings.length ? [{ type: 'text', text: out.warnings.join('\n') }] : []),
    ];
  },

  _offerCard: offerCard,
  _logoColor: logoColor,
};
