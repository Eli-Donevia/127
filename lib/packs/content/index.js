// Content engine: real questions, hooks in proven formats, film-ready scripts, week and month plans
// with calendar files, designed carousel slides, content pillars, one long piece turned into a week
// of posts, and a ranking of the member's own posts from numbers they export or paste (never
// scraped), all built from the member's own business facts.

const { searchQuestions, writeHooks } = require('./tools/hooks');
const { writeScript, shootSheet } = require('./tools/scripts');
const { planPostsTool, makeCalendar } = require('./tools/plan');
const makeCarousel = require('./tools/carousel');
const pillarsTool = require('./tools/pillars');
const { keyPoints, repurpose } = require('./tools/repurpose');
const rankPostsTool = require('./tools/rank');

const FACTS = {
  keyword: { type: 'string', title: 'Comment keyword (optional)', description: 'The word people comment to get your offer, like QUOTE. We pick one if you leave it empty.', maxLength: 20 },
  magnet: { type: 'string', title: 'What they get when they comment (optional)', description: 'For example "my price list" or "a free quote"', maxLength: 120 },
  area: { type: 'string', title: 'Neighborhood or area (optional)', description: 'Defaults to the area in your business profile', maxLength: 80 },
};
const factRefs = { keyword: '$inputs.keyword', magnet: '$inputs.magnet', area: '$inputs.area' };

function planWorkflow({ id, title, promise, minutes, days, hooks }) {
  return {
    id,
    title,
    promise,
    minutes,
    tier: 'builder',
    inputs: {
      type: 'object',
      properties: {
        perWeek: { type: 'integer', title: 'Posts a week', minimum: 1, maximum: 7, default: 5 },
        time: { type: 'string', title: 'Post time', description: '24-hour time, like 18:00', default: '18:00' },
        ...FACTS,
      },
    },
    steps: [
      { id: 'questions', tool: 'content.search_questions', input: { area: '$inputs.area' } },
      { id: 'hooks', tool: 'content.write_hooks', input: { questions: '$questions.questions', count: hooks, ...factRefs } },
      { id: 'plan', tool: 'content.plan_posts', input: { hooks: '$hooks.hooks', days, perWeek: '$inputs.perWeek', time: '$inputs.time', ...factRefs } },
      { id: 'review', approve: { title: 'Check the posts and edit any caption', items: '$plan.posts', edit: 'text', field: 'caption', label: 'title' } },
      { id: 'calendar', tool: 'content.make_calendar', input: { posts: '$review.items', filming: '$plan.filming', holidays: '$plan.holidays', area: '$inputs.area' } },
      { id: 'scripts', tool: 'content.write_script', each: '$plan.reels', estimate: 5, concurrency: 3, input: { hook: '$item', ask: '$item.ask', ...factRefs } },
      { id: 'sheet', tool: 'content.shoot_sheet', input: { scripts: '$scripts', area: '$inputs.area' } },
      { id: 'slides', tool: 'content.make_carousel', when: '$plan.carousel', input: { type: '$plan.carousel.type', ...factRefs } },
    ],
    result: ['calendar', 'sheet', 'slides', 'scripts'],
    next: ['content.carousel', 'content.hooks'],
  };
}

module.exports = {
  id: 'content',
  title: 'Content engine',
  version: '0.3.0',
  summary: 'Hooks from real searches, film-ready scripts, a posting calendar and designed carousels, all built from your own business, city and price.',
  niches: [],
  system: ['ffmpeg'],
  tools: [searchQuestions, writeHooks, writeScript, shootSheet, planPostsTool, makeCalendar, makeCarousel, pillarsTool, keyPoints, repurpose, rankPostsTool],
  workflows: [
    {
      id: 'content.hooks',
      title: '30 hooks for your business',
      promise: '30 hooks built from what people in your city really search, then 3 film-ready scripts with on-screen text, shots and captions.',
      minutes: 5,
      tier: 'free',
      inputs: { type: 'object', properties: { ...FACTS } },
      steps: [
        { id: 'questions', tool: 'content.search_questions', input: { area: '$inputs.area' } },
        { id: 'hooks', tool: 'content.write_hooks', input: { questions: '$questions.questions', count: 30, ...factRefs } },
        { id: 'pick', approve: { title: 'Pick 3 hooks to turn into scripts', choose: '$hooks.hooks', label: 'hook', detail: 'why', max: 3 } },
        { id: 'scripts', tool: 'content.write_script', each: '$pick.chosen', concurrency: 3, input: { hook: '$item', ...factRefs } },
        { id: 'sheet', tool: 'content.shoot_sheet', input: { scripts: '$scripts', area: '$inputs.area' } },
      ],
      result: ['hooks', 'scripts', 'sheet'],
      next: ['content.plan_week', 'content.carousel'],
    },
    {
      id: 'content.scripts',
      title: 'Scripts for your next 5 videos',
      promise: 'Add your own ideas or pick from 15 hooks, and get 5 scripts with what to say, what to show, the caption and your keyword.',
      minutes: 10,
      tier: 'builder',
      inputs: { type: 'object', properties: { ideas: { type: 'string', title: 'Your video ideas (optional)', description: 'One per line', maxLength: 2000 }, ...FACTS } },
      steps: [
        { id: 'questions', tool: 'content.search_questions', input: { area: '$inputs.area' } },
        { id: 'hooks', tool: 'content.write_hooks', input: { questions: '$questions.questions', count: 15, own: '$inputs.ideas', ...factRefs } },
        { id: 'pick', approve: { title: 'Pick up to 5 videos to script', choose: '$hooks.hooks', label: 'hook', detail: 'why', max: 5 } },
        { id: 'scripts', tool: 'content.write_script', each: '$pick.chosen', concurrency: 3, input: { hook: '$item', ...factRefs } },
        { id: 'sheet', tool: 'content.shoot_sheet', input: { scripts: '$scripts', area: '$inputs.area' } },
      ],
      result: ['scripts', 'sheet'],
      next: ['content.plan_week'],
    },
    planWorkflow({
      id: 'content.plan_week',
      title: 'Plan your week of posts',
      promise: 'A week of posts with hooks, captions and your keyword, calendar reminders, a shoot sheet for every video and one designed carousel.',
      minutes: 15,
      days: 7,
      hooks: 24,
    }),
    planWorkflow({
      id: 'content.plan_month',
      title: 'Plan your month of posts',
      promise: '30 days of posts in a CSV for Sheets or Notion, phone reminders, film days, scripts for the first 5 videos and a carousel.',
      minutes: 20,
      days: 30,
      hooks: 40,
    }),
    {
      id: 'content.carousel',
      title: 'Make a carousel',
      promise: 'A designed Instagram carousel in your colors, saved as PNG slides, a ZIP and a video version, with the caption written.',
      minutes: 5,
      tier: 'builder',
      inputs: {
        type: 'object',
        properties: {
          type: { type: 'string', title: 'Kind of carousel', enum: ['mistakes', 'myths', 'tips', 'signs', 'steps', 'questions', 'compare', 'checklist'], default: 'mistakes' },
          topic: { type: 'string', title: 'Title (optional)', maxLength: 90 },
          theme: { type: 'string', title: 'Look', enum: ['bold', 'dark', 'light'], default: 'bold' },
          color: { type: 'string', title: 'Brand color (optional)', description: 'A hex color like #0f766e', maxLength: 7 },
          ...FACTS,
        },
      },
      steps: [{ id: 'slides', tool: 'content.make_carousel', input: { type: '$inputs.type', topic: '$inputs.topic', theme: '$inputs.theme', color: '$inputs.color', ...factRefs } }],
      result: ['slides'],
      next: ['content.plan_week'],
    },
    {
      id: 'content.pillars',
      title: 'Set your content pillars',
      promise: 'Five content pillars named for your business, how often each one comes up at your pace, and ready ideas for each from real searches and your own topics.',
      proof: 'A printable pillars page with your rhythm and ideas, and an idea bank CSV for Sheets or Notion',
      minutes: 5,
      tier: 'builder',
      job: 'content',
      inputs: {
        type: 'object',
        properties: {
          perWeek: { type: 'integer', title: 'Posts a week', minimum: 1, maximum: 7, default: 5 },
          topics: { type: 'string', format: 'textarea', title: 'Your own topics (optional)', description: 'One per line, like "ceramic coating" or "pet hair"', maxLength: 600 },
          ...FACTS,
        },
      },
      steps: [
        { id: 'questions', tool: 'content.search_questions', input: { area: '$inputs.area' } },
        { id: 'pillars', tool: 'content.pillars', input: { questions: '$questions.questions', perWeek: '$inputs.perWeek', topics: '$inputs.topics', ...factRefs } },
      ],
      result: ['pillars'],
      next: [
        { id: 'content.plan_week', why: 'Turns these pillars into a week of posts in the same order, with captions and reminders.' },
        { id: 'content.hooks', why: '30 hooks from the same real searches, with 3 scripts to film first.' },
      ],
    },
    {
      id: 'content.repurpose',
      title: 'Turn one long piece into many',
      promise: 'Paste a blog post, newsletter or video transcript and get a carousel, 3 short video scripts, posts for 5 apps, a newsletter and quote cards.',
      proof: 'Carousel and quote card PNGs in a ZIP, a preview sheet, and a page with every post, script and the email, each checked against the app\'s limit',
      minutes: 10,
      tier: 'builder',
      job: 'content',
      inputs: {
        type: 'object',
        properties: {
          text: { type: 'string', format: 'textarea', title: 'Your long piece', description: 'Paste a blog post, newsletter or video transcript. Leave it empty to try a sample article.', maxLength: 30000 },
          url: { type: 'string', title: 'Or the page it is on (optional)', description: 'A public https page of yours, like your blog post', maxLength: 300 },
          title: { type: 'string', title: 'Title (optional)', maxLength: 120 },
          ...FACTS,
        },
      },
      steps: [
        { id: 'points', tool: 'content.key_points', input: { text: '$inputs.text', url: '$inputs.url', title: '$inputs.title' } },
        { id: 'pick', approve: { title: 'Pick the points to use (up to 7)', choose: '$points.points', label: 'title', detail: 'body', max: 7 } },
        { id: 'make', tool: 'content.repurpose', input: { points: '$pick.chosen', title: '$points.title', summary: '$points.summary', quotes: '$points.quotes', source: '$points.source', ...factRefs } },
      ],
      result: ['make'],
      next: [
        { id: 'content.plan_week', why: 'Fill the rest of the week with posts from real searches.' },
        { id: 'content.rank_posts', why: 'In a few weeks, rank these posts to see which kind did best.' },
      ],
    },
    {
      id: 'content.rank_posts',
      title: 'Rank your posts',
      promise: 'Add your post stats export or paste your numbers, and see which posts did best, why, and what to post more of, less of and next.',
      proof: 'A printable ranking with your top and lowest posts and groups by format, hook, day and time, and a CSV of every post with its score',
      minutes: 5,
      tier: 'builder',
      job: 'content',
      inputs: {
        type: 'object',
        properties: {
          file: { type: 'string', format: 'asset', accept: '.csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain', title: 'Your post stats (CSV)', description: 'Exported from your own account\'s insights or analytics, or a sheet saved as CSV. One row per post. Leave it empty to try sample posts.' },
          rows: { type: 'string', format: 'textarea', title: 'Or paste your posts', description: 'Copy the rows from a sheet with the header row on top, like: Date, Caption, Type, Views, Likes, Comments, Shares, Saves', maxLength: 200000 },
          keyword: FACTS.keyword,
          area: FACTS.area,
        },
      },
      steps: [{ id: 'rank', tool: 'content.rank_posts', input: { file: '$inputs.file', rows: '$inputs.rows', keyword: '$inputs.keyword', area: '$inputs.area' } }],
      result: ['rank'],
      next: [
        { id: 'content.plan_week', why: 'Plan next week with more of what worked here.' },
        { id: 'content.pillars', why: 'Fill the kinds of post missing from your mix, with ideas for each.' },
      ],
    },
  ],
};
