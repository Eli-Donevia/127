// Ranks the member's own Instagram posts by the comments they already get, so the keyword goes on
// posts people actually comment on. Uses 127's Instagram Business Discovery key when the server has
// it (wants: ['instagram']); without it, says how to find the same answer in Instagram Insights.
// In the harness's sample mode it shows sample posts, marked as samples.

const path = require('path');
const fs = require('fs');
const { views, text, time } = require('../../_kit');
const { readAccount, rank, cleanHandle } = require('../lib/instagram');
const { brain } = require('../../_kit');

const MANUAL = [
  'Open Instagram, go to your profile and open your professional dashboard.',
  'Open your account insights and find the list of your posts and reels.',
  'Sort it by comments and note the top 3. Those are where your keyword goes first.',
];

function samplePosts() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'sample', 'posts.json'), 'utf8'));
  } catch {
    return null;
  }
}

function advice(r, keyword) {
  const out = [];
  const K = keyword || 'your keyword';
  if (r.top.length) out.push(`Add a line to the captions of your top ${Math.min(3, r.top.length)} posts: "Comment ${K} and I'll send it to you."`);
  if (r.formats.length > 1 && r.formats[0].medianComments > 0) out.push(`${r.formats[0].type}s get the most comments for you (about ${Math.round(r.formats[0].medianComments)} each). Make your next keyword post a ${r.formats[0].type.toLowerCase()}.`);
  if (r.quiet.length) out.push(`${r.quiet.length === 1 ? 'One post gets' : `${r.quiet.length} posts get`} likes but few comments. A keyword line gives people a reason to comment.`);
  if (!out.length) out.push('Your posts get few comments so far, which is normal early on. Start with a new reel built around the keyword.');
  return out;
}

module.exports = {
  name: 'dm.rank_posts',
  title: 'Rank your posts',
  description: "Ranks your public Instagram posts and reels by the comments they get, so you know where to put your DM keyword. Needs a professional (business or creator) account.",
  kind: 'api',
  risk: 'read',
  needs: [],
  wants: ['instagram'],
  credits: 1,
  input: {
    type: 'object',
    properties: {
      instagram: { type: 'string', title: 'Instagram handle', maxLength: 60 },
      keyword: { type: 'string', title: 'Keyword', maxLength: 20 },
    },
  },
  output: {
    type: 'object',
    properties: { status: { type: 'string' }, handle: { type: 'string' }, top: { type: 'array' }, advice: { type: 'array' } },
    required: ['status', 'top', 'advice'],
  },
  async run(input, ctx) {
    const b = brain.brainOf(ctx, input);
    const handle = cleanHandle(input.instagram || b.instagram);
    const today = time.today(ctx);
    if (!handle) return { status: 'no_handle', handle: '', top: [], formats: [], advice: ['Add your Instagram handle to your business profile and we can rank your posts next time.', ...MANUAL] };
    let key = null;
    try {
      key = ctx.secret('instagram');
    } catch {
      key = null;
    }
    if (!key || !key.token || !key.userId) {
      const sample = ctx.sample ? samplePosts() : null;
      if (sample) {
        const r = rank(sample.posts, { today, followers: sample.followers });
        return { status: 'ok', handle, followers: sample.followers, counted: r.counted, top: r.top, formats: r.formats, quiet: r.quiet, advice: advice(r, input.keyword), sample: true };
      }
      return { status: 'not_connected', handle, top: [], formats: [], advice: MANUAL };
    }
    ctx.log(`Reading @${handle}'s public posts`);
    const acc = await readAccount(ctx, key, handle);
    if (acc.status === 'not_found') return { status: 'not_found', handle, top: [], formats: [], advice: [`We couldn't read @${handle}. Instagram only shares posts from public business and creator accounts. Switch to a professional account (free, in Settings) and ManyChat will work too.`, ...MANUAL] };
    if (acc.status !== 'ok') return { status: 'error', handle, top: [], formats: [], advice: [acc.message || "Instagram didn't answer. Try again in a minute.", ...MANUAL] };
    const r = rank(acc.posts, { today, followers: acc.profile.followers });
    return { status: 'ok', handle: acc.profile.handle, followers: acc.profile.followers, counted: r.counted, top: r.top, formats: r.formats, quiet: r.quiet, advice: advice(r, input.keyword) };
  },
  view(out) {
    if (out.status !== 'ok') {
      const lead = out.status === 'not_connected' ? "We can't read Instagram posts from here yet. Here's how to find your best posts in a minute:" : out.status === 'no_handle' ? 'No Instagram handle on file yet.' : out.advice[0];
      return views.blocks(views.text(lead), views.text((out.status === 'not_connected' ? out.advice : out.advice.slice(1)).map((a, i) => `${i + 1}. ${a}`).join('\n')));
    }
    return views.blocks(
      views.sampleNote(out, 'This ranking'),
      views.metric('Posts checked', out.counted || out.top.length, out.followers ? `@${out.handle}, ${out.followers.toLocaleString('en-US')} followers` : `@${out.handle}`),
      views.table(
        [
          { key: 'rank', label: '#' },
          { key: 'post', label: 'Post' },
          { key: 'type', label: 'Type' },
          { key: 'comments', label: 'Comments', format: 'number' },
          { key: 'date', label: 'Posted' },
          { key: 'permalink', label: 'Open', format: 'link' },
        ],
        out.top.map((p, i) => ({ rank: i + 1, post: text.clip(p.caption || 'No caption', 60), type: p.type, comments: p.comments, date: p.date ? time.shortDate(p.date) : '', permalink: p.permalink || '' }))
      ),
      views.text(out.advice.join('\n'))
    );
  },
};
