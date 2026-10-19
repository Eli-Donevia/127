// The gaps: what a gym is missing in video, proven with its own facts and its nearest competitors,
// and the videos that would fix it. This is the "why should I care" in every pitch.
// Rules: every gap names its evidence; comparisons only count what we actually checked; no
// industry statistics, no promised results.

const { kmBetween, plain } = require('./util');

// What each kind of gym can post, as shootable ideas. Craft knowledge, not claims.
const IDEAS = {
  gym: [
    { id: 'first-week', title: 'Your first week here', hook: 'Nervous about starting? Here is your first week.', shots: 'Front desk hello, coach walkthrough, a beginner set, a high five.' },
    { id: 'meet-coach', title: 'Meet the coach', hook: 'This is the coach who will learn your name.', shots: 'Coach talking to camera, coaching a member, one tip.' },
    { id: 'member-spotlight', title: 'Member spotlight', hook: 'She started six months ago. Here is what changed.', shots: 'Member interview (with their OK), training clips, a smile at the end.' },
    { id: 'crowd', title: '5am vs 5pm', hook: 'Which crowd are you?', shots: 'Same spot, morning and evening, quick cuts.' },
    { id: 'myth', title: 'One move everyone gets wrong', hook: 'You are doing this one wrong.', shots: 'Wrong version, coach fix, right version.' },
  ],
  crossfit: [
    { id: 'wod', title: "Today's workout in 15 seconds", hook: "Today's workout. Could you finish it?", shots: 'Whiteboard, three movement clips, the finish collapse.' },
    { id: 'scaling', title: 'How a beginner does the same workout', hook: 'Never done CrossFit? You can do this.', shots: 'Rx athlete and beginner side by side, coach scaling it.' },
    { id: 'pr-bell', title: 'PR bell moments', hook: 'The best sound in the gym.', shots: 'A lift, the bell, the crowd cheering.' },
    { id: 'coach-cue', title: 'Coach cue of the week', hook: 'One cue that fixed my squat.', shots: 'Coach to camera, member before and after the cue.' },
    { id: 'first-class', title: 'Your first class', hook: 'What your first class actually looks like.', shots: 'Warm-up, skill, workout, cooldown, high fives.' },
  ],
  yoga: [
    { id: 'flow', title: '60-second flow', hook: 'Take one minute. Breathe with us.', shots: 'Three poses from today, natural light, slow cuts.' },
    { id: 'teacher', title: 'Meet the teacher', hook: 'Meet the teacher behind the 6am flow.', shots: 'Teacher talking, teaching, one quiet moment.' },
    { id: 'bring', title: 'What to bring to your first class', hook: 'First class? Bring these three things.', shots: 'Mat, water, a towel, the front door.' },
    { id: 'ambience', title: 'The studio at sunrise', hook: 'This is how mornings should feel.', shots: 'Empty room, light, the first student arriving.' },
    { id: 'pose', title: 'Pose of the week', hook: 'Struggle with this pose? Try this.', shots: 'Teacher demo, one fix, the finished pose.' },
  ],
  pilates: [
    { id: 'reformer-101', title: 'Reformer 101', hook: 'Never been on a reformer? Here is how it works.', shots: 'Springs, carriage, footbar, one easy move.' },
    { id: 'class-preview', title: 'Class preview', hook: 'Fifty minutes in thirty seconds.', shots: 'Warm-up, burn, stretch, the smile at the end.' },
    { id: 'instructor', title: 'Instructor spotlight', hook: 'Meet the instructor everyone books first.', shots: 'Instructor intro, cueing a class, one tip.' },
    { id: 'first-class', title: 'Before your first class', hook: 'Booked your first class? Watch this.', shots: 'Grip socks, check-in, setup, the first move.' },
    { id: 'slowmo', title: 'Slow-motion form', hook: 'Control is the whole point.', shots: 'Slow-motion movement, close-ups, quiet music.' },
  ],
  boxing: [
    { id: 'combo', title: 'Learn one combo', hook: 'Learn this combo in 15 seconds.', shots: 'Coach demo, slow, full speed, on the bag.' },
    { id: 'first-class', title: 'First class nerves', hook: 'Never thrown a punch? Start here.', shots: 'Wrapping hands, first jab, coach encouragement.' },
    { id: 'coach', title: 'Meet the coach', hook: 'This coach will push you. Kindly.', shots: 'Coach intro, pads work, a laugh.' },
    { id: 'finisher', title: 'The finisher', hook: 'The last 60 seconds of class.', shots: 'Bag sprint, timer, everyone on the floor.' },
    { id: 'stress', title: 'Leave work at the door', hook: 'Bad day? Hit something.', shots: 'Walking in tense, hitting the bag, walking out lighter.' },
  ],
  martial_arts: [
    { id: 'promotion', title: 'Belt promotion day', hook: 'The day they earned it.', shots: 'Families watching, belt tied, bow, cheers. Only with parents OK for any kids on camera.' },
    { id: 'technique', title: 'Technique of the week', hook: 'One move every beginner should know.', shots: 'Instructor demo, slow, partner drill.' },
    { id: 'first-class', title: 'Your first class', hook: 'What happens in your first class.', shots: 'Bow in, warm-up, a drill, the high five.' },
    { id: 'instructor', title: 'Meet the instructor', hook: 'Twenty years on the mat. Meet the instructor.', shots: 'Instructor story, teaching, one demo.' },
    { id: 'adults', title: 'Adults can start too', hook: 'Too old to start? No.', shots: 'Adult beginners training, instructor encouragement.' },
  ],
  climbing: [
    { id: 'route-set', title: 'New routes timelapse', hook: 'Brand new problems just went up.', shots: 'Setters timelapse, the first send.' },
    { id: 'first-timer', title: 'First-timer guide', hook: 'Never climbed? Here is your first visit.', shots: 'Shoes, belay check, first wall, top out.' },
    { id: 'problem', title: 'Problem of the week', hook: 'Can you send this one?', shots: 'Fails, beta, the send.' },
    { id: 'community', title: 'Community night', hook: 'Come for the walls. Stay for the people.', shots: 'Crowd, music, high fives.' },
    { id: 'parties', title: 'Birthday parties', hook: 'The best birthday party in town.', shots: 'Kids climbing, cake, parents smiling. Only with parents OK.' },
  ],
  cycling: [
    { id: 'drop', title: 'The beat drop', hook: 'Wait for the drop.', shots: 'Lights down, the drop, the whole room standing.' },
    { id: 'instructor', title: 'Meet your instructor', hook: 'The playlist is personal.', shots: 'Instructor intro, mic moment, room energy.' },
    { id: 'first-ride', title: 'Your first ride', hook: 'First ride? Do these three things.', shots: 'Bike setup, shoes, the first climb.' },
    { id: 'playlist', title: 'Playlist reveal', hook: "Tonight's ride, in 15 seconds.", shots: 'Track names on screen, fast cuts on the beat.' },
    { id: 'after', title: 'After the ride', hook: 'This feeling, every time.', shots: 'Sweaty smiles, towels, high fives.' },
  ],
  dance: [
    { id: 'combo', title: 'Combo of the week', hook: 'Learn this in 15 seconds.', shots: 'Teacher demo, slow, full speed, the class doing it.' },
    { id: 'recital', title: 'Recital highlights', hook: 'Months of practice. One night.', shots: 'Backstage, the stage, the bow. Only with parents OK for kids.' },
    { id: 'teacher', title: 'Teacher spotlight', hook: 'Meet the teacher behind the moves.', shots: 'Teacher intro, teaching, a solo moment.' },
    { id: 'class-preview', title: 'Class preview', hook: 'What an adult beginner class looks like.', shots: 'Warm-up, learning, the final run-through.' },
    { id: 'bts', title: 'Behind the scenes', hook: 'What you do not see before the show.', shots: 'Costumes, rehearsal, nerves, the curtain.' },
  ],
};
IDEAS.other = IDEAS.gym;

const CATEGORY_LABEL = { gym: 'gym', crossfit: 'CrossFit box', yoga: 'yoga studio', pilates: 'Pilates studio', boxing: 'boxing gym', martial_arts: 'martial arts school', climbing: 'climbing gym', cycling: 'cycling studio', dance: 'dance studio', other: 'studio' };

const OFFER_LABEL = { free_class: 'free first class', free_pass: 'free trial pass', free_consult: 'free intro session', intro_price: 'intro offer', challenge: 'challenge' };

// ranked: [{ gym, site, content, score }]. Nearest competitors: same category first, then any, max 5.
const possessive = (name) => (/s$/i.test(name) ? `${name}'` : `${name}'s`);

function competitorsOf(row, rows, max = 5) {
  // Compare with gyms whose own website we read: not brand pages, not the same business's other location.
  const seen = new Set([row.gym.name]);
  const others = rows.filter((r) => {
    if (r === row || !r.site || !r.site.reachable || r.site.brandSite || r.gym.owner === 'public') return false;
    if (seen.has(r.gym.name) || (row.site && r.site.domain && r.site.domain === row.site.domain)) return false;
    seen.add(r.gym.name);
    return true;
  });
  const dist = (r) => kmBetween(row.gym.lat, row.gym.lon, r.gym.lat, r.gym.lon);
  const same = others.filter((r) => r.gym.category === row.gym.category).sort((a, b) => dist(a) - dist(b));
  const rest = others.filter((r) => r.gym.category !== row.gym.category).sort((a, b) => dist(a) - dist(b));
  return same.concat(rest).slice(0, max).map((r) => ({ name: r.gym.name, km: Math.round(dist(r) * 10) / 10, sameCategory: r.gym.category === row.gym.category, row: r }));
}

// What we checked about a competitor, for comparisons the member can show the owner.
function compFacts({ row: r, ...c }) {
  return {
    ...c,
    video: !!(r.site && r.site.video && r.site.video.onSite),
    tiktok: !!(r.site && r.site.socials && r.site.socials.tiktok),
    lastPostDays: r.content && !r.content.unavailable && Number.isFinite(r.content.daysSinceLastPost) ? r.content.daysSinceLastPost : null,
  };
}

function gapsFor(row, rows) {
  const { gym, site, content: ig, score } = row;
  // A franchise's brand page isn't the local owner's to change: judge only what they run.
  const s = site && site.reachable && !site.brandSite ? site : null;
  const comps = competitorsOf(row, rows);
  const gaps = [];
  const compsWith = (fn) => comps.filter((c) => fn(c.row)).map((c) => c.name);
  const offer = s && s.offer && s.offer.kind !== 'none' ? s.offer : null;

  if (s && !s.video.onSite && !s.video.unknown) {
    const withVideo = compsWith((r) => r.site.video.onSite);
    gaps.push({
      id: 'site-video',
      title: 'No video on the website',
      evidence: withVideo.length
        ? `No video on ${possessive(gym.name)} homepage or main pages. ${withVideo.length} of the ${comps.length} nearest gyms we checked have one (${withVideo.slice(0, 3).join(', ')}).`
        : `No video on ${possessive(gym.name)} homepage or main pages, so a first-timer can't see what a class looks like before booking.`,
      check: `Open ${s.domain || 'their site'} and scroll the homepage: a scan can miss a video that only loads later.`,
      say: withVideo.length
        ? `your website has no video yet, and ${withVideo.length === 1 ? 'one gym' : `${withVideo.length} gyms`} near you ${withVideo.length === 1 ? 'has' : 'have'} one`
        : 'your website has no video of a class yet',
      fix: `A 30-second "what a class looks like" video at the top of the homepage${offer ? `, ending on the ${OFFER_LABEL[offer.kind]}` : ''}.`,
      weight: 3,
    });
  }
  if (ig && Number.isFinite(ig.daysSinceLastPost) && ig.daysSinceLastPost > 14) {
    gaps.push({
      id: 'quiet',
      title: 'Instagram has gone quiet',
      evidence: `Last post ${ig.daysSinceLastPost} days ago (@${ig.handle}).`,
      say: `your last Instagram post was ${ig.daysSinceLastPost} days ago`,
      fix: 'One 45-minute shoot a week gives 3 or 4 Reels, so the page never goes quiet again.',
      weight: 3,
    });
  }
  if (ig && Number.isFinite(ig.reelsShare) && ig.reelsShare < 0.5) {
    gaps.push({
      id: 'reels',
      title: 'Mostly photos, few Reels',
      evidence: `${Math.round(ig.reelsShare * 100)}% of its last ${ig.sampled || 12} posts are Reels.`,
      say: `only ${Math.round(ig.reelsShare * (ig.sampled || 12))} of your last ${ig.sampled || 12} posts are Reels`,
      fix: 'Turn the same moments into short Reels: coach cues, class energy, member wins.',
      weight: 2,
    });
  }
  if (ig && Number.isFinite(ig.engagementRate) && ig.engagementRate < 1 && ig.followers >= 300) {
    gaps.push({
      id: 'engagement',
      title: 'Followers, but few reactions',
      evidence: `${ig.followers} followers; a typical recent post gets ${ig.medianEngagement || 0} likes and comments.`,
      say: `you have ${ig.followers} followers, but a typical post gets ${ig.medianEngagement || 0} likes and comments`,
      fix: 'Posts built on a hook in the first second and real people, not flyers.',
      weight: 1,
    });
  }
  const tiktok = score && score.contact && score.contact.tiktok;
  if (s && !tiktok && ['crossfit', 'boxing', 'climbing', 'dance', 'martial_arts', 'cycling'].includes(gym.category)) {
    const withTt = compsWith((r) => r.site.socials && r.site.socials.tiktok);
    gaps.push({
      id: 'tiktok',
      title: 'Not on TikTok',
      evidence: withTt.length ? `No TikTok linked from its site. ${withTt.length} nearby gym${withTt.length > 1 ? 's are' : ' is'} on TikTok (${withTt.slice(0, 2).join(', ')}).` : 'No TikTok linked from its site.',
      say: withTt.length ? `you're not on TikTok yet, and ${withTt.length === 1 ? 'a gym' : `${withTt.length} gyms`} near you ${withTt.length === 1 ? 'is' : 'are'}` : "you're not on TikTok yet",
      fix: 'Post the same Reels to TikTok. Zero extra filming.',
      weight: 1,
    });
  }
  if (s && (s.tracking.metaPixel || s.tracking.googleAds) && !s.video.onSite) {
    gaps.push({
      id: 'ads',
      title: 'Pays for ads, no video to show',
      evidence: `A ${s.tracking.metaPixel ? 'Meta' : 'Google'} ad pixel is on its site, so it has run ads. Check its Meta Ad Library page: if the ads are still images, video is the obvious upgrade.`,
      say: 'you run ads but have no video on your site to send people to',
      fix: 'Three 15-second ad cuts from one shoot, each with a different first line.',
      weight: 2,
    });
  }
  if (offer && !(s && s.video.onSite)) {
    gaps.push({
      id: 'offer',
      title: 'A good offer nobody sees',
      kind: offer.kind,
      evidence: `The site offers "${offer.text}", but only as text.`,
      say: `your "${offer.text}" offer is only text on your site`,
      fix: `A 15-second Reel that sells the ${OFFER_LABEL[offer.kind]}: who it's for, what happens, how to book.`,
      weight: 2,
    });
  }
  if (s && !s.testimonials) {
    gaps.push({
      id: 'stories',
      title: 'No member stories',
      evidence: 'The site has no testimonials or member stories.',
      say: 'your site has no member stories yet',
      fix: 'One member spotlight a month (with the member\'s OK).',
      weight: 1,
    });
  }
  if (s && s.links && s.links.team && !s.video.onSite) {
    gaps.push({
      id: 'coaches',
      title: 'Coaches are names, not faces',
      evidence: 'It has a team page but no coach videos.',
      say: 'your coaches are on your team page, but not on video',
      fix: 'A 20-second intro Reel for each coach.',
      weight: 1,
    });
  }
  if (!s && !ig && !(site && site.brandSite)) {
    gaps.push({
      id: 'unknown',
      title: 'Not checked yet',
      evidence: site && site.reason ? site.reason : 'No website listed.',
      fix: 'Open its Instagram and add a screenshot to check it.',
      weight: 0,
    });
  }
  if (!gaps.length && site && site.brandSite) {
    gaps.push({
      id: 'local',
      title: 'Local Instagram not checked',
      evidence: "Its website is the brand's page, so the local story is on its own Instagram.",
      say: 'your location could have its own local videos',
      fix: 'Check its local Instagram with a screenshot before pitching.',
      weight: 0,
    });
  }
  gaps.sort((a, b) => b.weight - a.weight);
  return { gaps: gaps.slice(0, 4), competitors: comps.map(compFacts) };
}

function ideasFor(gym, gaps, n = 3) {
  const list = IDEAS[gym.category] || IDEAS.gym;
  const want = [];
  const has = (id) => gaps.some((g) => g.id === id);
  if (has('site-video') || has('offer')) want.push(list.find((i) => /first|class-preview|first-timer|first-ride/.test(i.id)));
  if (has('stories')) want.push(list.find((i) => /spotlight|promotion|recital|after|community/.test(i.id)));
  if (has('coaches')) want.push(list.find((i) => /coach|teacher|instructor/.test(i.id)));
  for (const i of list) if (want.length < n + 2) want.push(i);
  return [...new Set(want.filter(Boolean))].slice(0, n);
}

// One sentence the member can open with, said to the owner. Built only from the top gap's evidence.
function openerFor(gym, gaps) {
  const top = gaps[0];
  if (!top) return `I made a short sample Reel for ${gym.name} to show what I do.`;
  switch (top.id) {
    case 'site-video':
      return 'I noticed your website doesn\'t have a video of a class yet, so I made a short one to show what that could look like.';
    case 'quiet':
      return 'I noticed your Instagram has been quiet for a few weeks, so I made a sample Reel you could post this week.';
    case 'reels':
      return 'I noticed you post mostly photos, so I turned one idea into a short Reel to show the difference.';
    case 'offer':
      return `I saw the ${OFFER_LABEL[top.kind] || 'offer'} on your site and made a 15-second Reel that sells it.`;
    case 'ads':
      return 'I saw you run ads, so I made a 15-second video version to show what a video ad could look like.';
    case 'tiktok':
      return 'I noticed you\'re not on TikTok yet, so I made a sample that works on both TikTok and Instagram.';
    case 'engagement':
      return 'I made a short sample Reel for you built the way posts that get reactions are built: a hook in the first second and real people.';
    default:
      return `I made a short sample Reel for ${gym.name} to show what I'd make every week.`;
  }
}

function report(row, rows) {
  const { gaps, competitors } = gapsFor(row, rows);
  const ideas = ideasFor(row.gym, gaps);
  return {
    gaps,
    competitors,
    ideas,
    opener: plain(openerFor(row.gym, gaps)),
    label: CATEGORY_LABEL[row.gym.category] || 'gym',
  };
}

module.exports = { IDEAS, CATEGORY_LABEL, OFFER_LABEL, gapsFor, ideasFor, openerFor, competitorsOf, report };
