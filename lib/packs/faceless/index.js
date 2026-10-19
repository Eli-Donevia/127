// Faceless content channel. Months to a first $1, so the pack says so and builds the habit first:
// ideas people already look up (Wikipedia page views), scripts written from sourced facts in plain
// spoken words, videos voiced and rendered by the video pack, titles and covers, an upload plan,
// the program rules stated exactly, and a sponsor pitch from the numbers the member types.
// Nothing is posted and no one is contacted.

const NICHE = require('./data/niche.json');
const C = require('./lib/channel');
const S = require('./lib/script');

const NICHE_HELP = `What your channel is about: ${C.NICHE_IDS.map((id) => `${id} (${NICHE.niches[id].label.toLowerCase()})`).join(', ')}.`;
const NICHE_PICK = { type: 'string', title: 'Pick a niche', description: NICHE_HELP, enum: C.NICHE_IDS, default: 'space' };
const NICHE_SAME = { type: 'string', title: 'Niche (optional)', description: 'Leave it empty to use the one you picked last.', enum: C.NICHE_IDS };
const LENGTH = { type: 'string', title: 'Length', enum: Object.keys(S.LENGTHS), default: 'short', description: "short: under a minute, for Shorts and Reels. minute: just over a minute, the length TikTok's Creator Rewards counts." };
const VOICE = { type: 'string', title: 'Voice', enum: ['female', 'male'], default: 'female' };
const CHECK_NOTE = 'HOOK first, then one LINE per sentence, then CTA. Read it out loud once and change anything you would not say that way: your own words are what YouTube pays for.';

module.exports = {
  id: 'faceless',
  title: 'Faceless channel',
  version: '0.2.0',
  summary: 'Short videos without your face: ideas people already look up, scripts from sourced facts, voiced videos with captions, titles and covers, an upload plan with the exact program rules, and a sponsor pitch.',
  niches: ['faceless'],
  business: true,
  uses: ['video'],
  system: ['ffmpeg'],
  notYet: NICHE.crowd.not_yet,
  tools: [
    require('./tools/find-ideas'),
    require('./tools/write-script'),
    require('./tools/write-scripts'),
    require('./tools/write-titles'),
    require('./tools/plan-posts'),
    require('./tools/sponsor-kit'),
  ],
  workflows: [
    {
      id: 'faceless.first_25',
      title: 'Your first 25',
      promise: '25 short-video ideas people already look up, ranked by last month\'s Wikipedia views, then your first video: script, voice, captions and cover.',
      proof: 'An honest crowd check, 25 ideas with their page views and links, and a vertical MP4 with voice, word-by-word captions and music, plus its cover',
      minutes: 8,
      tier: 'free',
      job: 'content',
      starter: true,
      inputs: { type: 'object', properties: { niche: NICHE_PICK, voice: VOICE }, required: ['niche'] },
      steps: [
        { id: 'ideas', tool: 'faceless.find_ideas', input: { niche: '$inputs.niche', count: 25 } },
        { id: 'pick', approve: { title: 'Pick the idea for your first video', choose: '$ideas.ideas', label: 'title', detail: 'evidence', max: 1, note: 'Ranked by how many people looked the topic up on Wikipedia last month. Pick one you find interesting: it shows.' } },
        { id: 'script', tool: 'faceless.write_script', input: { idea: '$pick.chosen', niche: '$inputs.niche' } },
        { id: 'check', approve: { title: 'Read and edit your script', items: '$script.scripts', edit: 'text', label: 'title', note: CHECK_NOTE } },
        { id: 'video', tool: 'video.promo', input: { script: '$check.items.0', format: 'vertical', voice: '$inputs.voice', robot: true, captions: 'words', label: '$script.label', color: '$script.color', stock: '$script.stock' } },
      ],
      result: ['ideas', 'script', 'video'],
      next: [
        { id: 'faceless.scripts_30', why: 'Write your next 30 scripts at once, each on a topic you haven\'t made yet.' },
        { id: 'faceless.make_one', why: 'Make the next video from any topic you type, or with your own voice.' },
      ],
    },
    {
      id: 'faceless.scripts_30',
      title: 'Your next 30 scripts',
      promise: '30 scripts on topics people looked up last month and you haven\'t made yet, from their Wikipedia facts, with titles, cover words and descriptions.',
      proof: 'A printable page of 30 scripts to record from, and a spreadsheet with every title, cover and description',
      minutes: 10,
      tier: 'builder',
      job: 'content',
      inputs: {
        type: 'object',
        properties: {
          niche: NICHE_SAME,
          length: LENGTH,
          topics: { type: 'string', format: 'textarea', title: 'Your own topics, one per line (optional)', description: 'Leave it empty for the most looked-up topics you haven\'t made yet.', maxLength: 3000 },
        },
      },
      steps: [{ id: 'scripts', tool: 'faceless.write_scripts', input: { niche: '$inputs.niche', length: '$inputs.length', topics: '$inputs.topics', count: 30 } }],
      result: ['scripts'],
      next: [
        { id: 'faceless.posting_plan', why: 'Put these 30 on your calendar, with a tracker.' },
        { id: 'faceless.make_one', why: 'Turn one into a video: paste its lines, or add your recording of it.' },
      ],
      suggestSchedule: { cron: '0 8 1 * *', label: 'On the 1st of every month at 8am' },
    },
    {
      id: 'faceless.make_one',
      title: 'Make one video',
      promise: 'One faceless short from a topic you type or a script you paste: voiced, with word-by-word captions, music and footage, plus its cover.',
      proof: 'A vertical MP4 with voice, captions and music, its cover image and the voiceover as an MP3',
      minutes: 6,
      tier: 'builder',
      job: 'content',
      inputs: {
        type: 'object',
        properties: {
          topic: { type: 'string', title: 'What is the video about?', description: 'Like "Saturn\'s rings" or "the Rosetta Stone". We look it up on Wikipedia.', maxLength: 120 },
          niche: NICHE_SAME,
          length: LENGTH,
          script: { type: 'string', format: 'textarea', title: 'Or your own script (optional)', description: 'Paste one of your 30 scripts or write your own. The first line is the hook.', maxLength: 3000 },
          recording: { type: 'string', format: 'asset', accept: 'audio/*,video/*', title: 'You reading it (optional)', description: 'Record the script on your phone, reading the lines in order. It replaces the computer voice.' },
          footage: { type: 'array', title: 'Your own clips or photos (optional)', description: 'Up to 6. They play behind the words, one per scene.', items: { type: 'string', format: 'asset', accept: 'video/*,image/*' }, maxItems: 6 },
          voice: VOICE,
        },
      },
      steps: [
        { id: 'script', tool: 'faceless.write_script', input: { topic: '$inputs.topic', niche: '$inputs.niche', length: '$inputs.length', own: '$inputs.script', recording: '$inputs.recording' } },
        { id: 'check', approve: { title: 'Read and edit your script', items: '$script.scripts', edit: 'text', label: 'title', note: CHECK_NOTE } },
        { id: 'voice', tool: 'video.voice', when: '$script.needVoice', input: { script: '$check.items.0', gender: '$inputs.voice' } },
        { id: 'video', tool: 'video.promo', input: { script: '$check.items.0', format: 'vertical', voiceover: '$voice.audio', lines: '$voice.lines', words: '$voice.words', voiceName: '$voice.voice', recording: '$inputs.recording', captions: 'words', label: '$script.label', color: '$script.color', stock: '$script.stock', footage: '$inputs.footage' } },
      ],
      result: ['script', 'voice', 'video'],
      next: [
        { id: 'faceless.titles', why: 'Make the covers and titles for your next 12 videos in one look.' },
        { id: 'faceless.posting_plan', why: 'Put your next uploads on a calendar you can keep.' },
      ],
    },
    {
      id: 'faceless.titles',
      title: 'Titles and covers',
      promise: '5 titles and cover words for each of your next 12 videos, true to each topic\'s facts, and their covers rendered in one look.',
      proof: 'A spreadsheet of titles and cover words, 12 tall covers as JPGs, and a sheet that shows them side by side like your profile',
      minutes: 5,
      tier: 'builder',
      job: 'content',
      inputs: {
        type: 'object',
        properties: {
          topics: { type: 'string', format: 'textarea', title: 'Your next videos, one per line (optional)', description: 'Topics or working titles. Leave it empty to use your last batch of scripts.', maxLength: 2000 },
          niche: NICHE_SAME,
          image: { type: 'string', format: 'asset', accept: 'image/*,video/*', title: 'A photo or video for the covers (optional)', description: 'Without one, the covers use your colors.' },
          design: { type: 'string', title: 'Cover design', enum: ['split', 'block', 'photo'], default: 'split', description: 'split: words on a panel beside your photo. block: words on a block of color. photo: words over the whole photo.' },
        },
      },
      steps: [
        { id: 'titles', tool: 'faceless.write_titles', input: { topics: '$inputs.topics', niche: '$inputs.niche', count: 12 } },
        { id: 'covers', tool: 'video.thumbnail', input: { items: '$titles.covers', shape: 'tall', design: '$inputs.design', image: '$inputs.image', color: '$titles.color', name: '$titles.name', title: '$titles.sheetTitle' } },
      ],
      result: ['titles', 'covers'],
      next: [
        { id: 'faceless.posting_plan', why: 'Put these videos on a calendar, with a tracker.' },
        { id: 'faceless.make_one', why: 'Make the first of them.' },
      ],
    },
    {
      id: 'faceless.posting_plan',
      title: 'Your upload plan',
      promise: 'Your next 30 uploads on the days you pick, as a calendar and a tracker, with what YouTube and TikTok ask before they pay, dated.',
      proof: 'A calendar file of upload days, a tracker spreadsheet and the program rules with their links',
      minutes: 3,
      tier: 'builder',
      job: 'ops',
      inputs: {
        type: 'object',
        properties: {
          perWeek: { type: 'integer', title: 'Uploads a week', enum: [3, 5, 7], default: 3, description: '3: Monday, Wednesday and Friday. 5: weekdays. 7: every day. Pick what you can keep up.' },
          time: { type: 'string', title: 'Time of day', description: 'A time you can keep, 24 hour, like 17:00.', maxLength: 5, default: '17:00' },
          start: { type: 'string', format: 'date', title: 'First upload day (optional)', description: 'Leave it empty to start next Monday, or the day after your last plan ends.' },
          titles: { type: 'string', format: 'textarea', title: 'Titles, one per line (optional)', description: 'Leave it empty to use your last batch of scripts.', maxLength: 4000 },
          niche: NICHE_SAME,
        },
      },
      steps: [{ id: 'plan', tool: 'faceless.plan_posts', input: { perWeek: '$inputs.perWeek', time: '$inputs.time', start: '$inputs.start', titles: '$inputs.titles', niche: '$inputs.niche', count: 30 } }],
      result: ['plan'],
      next: [
        { id: 'faceless.sponsor_pitch', why: 'Once you have views to show, pitch a brand.' },
        { id: 'faceless.scripts_30', why: 'Running low on scripts? Write the next 30.' },
      ],
    },
    {
      id: 'faceless.sponsor_pitch',
      title: 'Pitch a sponsor',
      promise: 'A one-page media kit from the numbers you type, a pitch email and follow-up for the brand you name, and how to label a paid video.',
      proof: 'A media kit page and picture, a pitch email and follow-up ready to send, and the YouTube, TikTok and FTC labelling rules',
      minutes: 8,
      tier: 'builder',
      job: 'sales',
      inputs: {
        type: 'object',
        properties: {
          brand: { type: 'string', title: 'Brand to pitch', description: 'One whose product your viewers already use. It goes in your Pipeline.', maxLength: 80 },
          channel: { type: 'string', title: 'Channel name (optional)', description: 'Leave it empty to use your business name.', maxLength: 80 },
          contact: { type: 'string', title: 'Their first name (optional)', maxLength: 40 },
          contactEmail: { type: 'string', title: 'Their email (optional)', maxLength: 120 },
          product: { type: 'string', title: 'What they sell (optional)', maxLength: 120 },
          fit: { type: 'string', title: 'Why your viewers would care (optional)', description: 'One sentence in your words, like "My viewers ask which telescope to start with."', maxLength: 240 },
          views28: { type: 'integer', title: 'Views in the last 28 days', description: 'From YouTube Studio and TikTok Studio, added up.', minimum: 0 },
          avgViews: { type: 'integer', title: 'Average views per video (optional)', minimum: 0 },
          youtubeSubs: { type: 'integer', title: 'YouTube subscribers (optional)', minimum: 0 },
          tiktokFollowers: { type: 'integer', title: 'TikTok followers (optional)', minimum: 0 },
          videos28: { type: 'integer', title: 'Videos posted in the last 28 days (optional)', minimum: 0 },
          audience: { type: 'string', title: 'Who watches (optional)', description: 'From your analytics, like "Mostly 18 to 34".', maxLength: 160 },
          countries: { type: 'string', title: 'Top countries (optional)', maxLength: 120 },
          rate: { type: 'number', title: 'Your price for one sponsored video, in dollars (optional)', minimum: 0 },
          email: { type: 'string', title: 'Your business email', maxLength: 120 },
        },
      },
      steps: [
        {
          id: 'kit',
          tool: 'faceless.sponsor_kit',
          input: { brand: '$inputs.brand', channel: '$inputs.channel', contact: '$inputs.contact', contactEmail: '$inputs.contactEmail', product: '$inputs.product', fit: '$inputs.fit', views28: '$inputs.views28', avgViews: '$inputs.avgViews', youtubeSubs: '$inputs.youtubeSubs', tiktokFollowers: '$inputs.tiktokFollowers', videos28: '$inputs.videos28', audience: '$inputs.audience', countries: '$inputs.countries', rate: '$inputs.rate', email: '$inputs.email' },
        },
      ],
      result: ['kit'],
      next: [
        { id: 'faceless.scripts_30', why: 'Keep the uploads coming: your next 30 scripts.' },
        { id: 'faceless.titles', why: 'Freshen your covers so the profile looks like one channel.' },
      ],
    },
  ],
};
