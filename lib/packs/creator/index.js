// Creator business: someone growing an audience around a topic, then earning from sponsors, a small
// product or a paid community later. Your first 25 true fans (people they know, the groups they're
// in, local libraries and community spaces from OpenStreetMap), niche and pillars, a 30-day plan,
// hooks and scripts, a media kit with only their own numbers, sponsor pitches to brands they name, a
// rate card from their own hours, a lead magnet, a weekly newsletter and an insights reader.
// Drafts only: the member posts and sends. Niche facts: data/niche.json.

const first = require('./tools/first25');
const pillars = require('./tools/pillars');
const plan = require('./tools/plan-month');
const hooks = require('./tools/hooks');
const kit = require('./tools/media-kit');
const pitches = require('./tools/sponsor-pitches');
const rates = require('./tools/rate-card');
const magnet = require('./tools/lead-magnet');
const letter = require('./tools/newsletter');
const insights = require('./tools/insights');
const NICHE = require('./data/niche.json');

const pass = (tool) => Object.fromEntries(Object.keys(tool.input.properties).map((k) => [k, `$inputs.${k}`]));
const inputsOf = (tool) => ({ type: 'object', properties: tool.input.properties, ...(tool.input.required ? { required: tool.input.required } : {}) });
const one = (id, tool, w) => ({ id, inputs: inputsOf(tool), steps: [{ id: 'run', tool: tool.name, input: pass(tool) }], result: ['run'], ...w });

module.exports = {
  id: 'creator',
  title: 'Creator business',
  version: '0.1.0',
  business: true,
  held: true,
  summary: 'Grow an audience around your topic: your first 25 true fans, pillars and a 30-day plan, hooks and scripts, a media kit with your own numbers, sponsor pitches, a rate card, a lead magnet, a weekly newsletter and an insights reader.',
  niches: ['creator', 'influencer', 'grow an audience', 'sponsorships', 'newsletter', 'youtube channel', 'instagram creator', 'tiktok creator'],
  notYet: NICHE.crowd.not_yet,
  uses: [],
  tools: [first, pillars, plan, hooks, kit, pitches, rates, magnet, letter, insights],
  workflows: [
    one('creator.first_25', first, {
      title: 'Your first 25',
      promise: '15 people you know with a personal DM each, plus a post for each group you are in and local spaces that host community talks.',
      proof: 'An honest crowd check, 25 names or groups with a message each, a dated plan and a CSV, saved to your Pipeline',
      minutes: 15,
      tier: 'free',
      job: 'leads',
      starter: true,
      next: [
        { id: 'creator.pillars', why: 'Before they follow, know what you post about each week.' },
        { id: 'creator.lead_magnet', why: 'Give them a reason to join your email list.' },
      ],
    }),
    one('creator.pillars', pillars, {
      title: 'Find your niche and pillars',
      promise: 'One sentence on who you post for, five content pillars with four post ideas each, and an Instagram and TikTok bio counted to the limit.',
      minutes: 6,
      tier: 'builder',
      job: 'content',
      next: [
        { id: 'creator.plan_month', why: 'Turn the pillars into 30 days of posts.' },
        { id: 'creator.hooks', why: 'Write the openings for your first videos.' },
      ],
    }),
    one('creator.plan_month', plan, {
      title: 'Your 30-day posting plan',
      promise: 'Which day, which pillar, a post idea and a format for the next 30 days at your pace, plus a weekly email, as a CSV and calendar.',
      minutes: 4,
      tier: 'builder',
      job: 'content',
      next: [
        { id: 'creator.hooks', why: 'Write the hooks for this week\'s posts.' },
        { id: 'creator.insights', why: 'After a month, see what worked.' },
      ],
    }),
    one('creator.hooks', hooks, {
      title: 'Hooks and scripts',
      promise: '20 opening lines for one topic and 3 short video scripts with a hook, three beats and a close, timed for 30 or 60 seconds.',
      minutes: 5,
      tier: 'builder',
      job: 'content',
      next: [{ id: 'creator.plan_month', why: 'Put the scripts on your calendar.' }],
    }),
    one('creator.media_kit', kit, {
      title: 'Media kit',
      promise: 'A printable one-page media kit in your colors with your numbers exactly as you type them, blanks for the rest, and how to reach you.',
      minutes: 8,
      tier: 'builder',
      job: 'sales',
      next: [
        { id: 'creator.rate_card', why: 'Add prices from your own hours.' },
        { id: 'creator.sponsor_pitches', why: 'Send the kit to brands you already use.' },
      ],
    }),
    one('creator.sponsor_pitches', pitches, {
      title: 'Sponsor pitches',
      promise: 'A short pitch email to each brand you name, built on why you use it and what you would make, with the disclosure rules for a yes.',
      minutes: 8,
      tier: 'builder',
      job: 'sales',
      next: [
        { id: 'creator.media_kit', why: 'Link your media kit in each pitch.' },
        { id: 'creator.rate_card', why: 'Know your price before they ask.' },
      ],
    }),
    one('creator.rate_card', rates, {
      title: 'Rate card',
      promise: 'Prices for each thing you make from your own hourly number, hours and costs, with add-ons for usage rights, exclusivity and rush.',
      minutes: 5,
      tier: 'builder',
      job: 'money',
      next: [{ id: 'creator.media_kit', why: 'Put the prices on your media kit.' }],
    }),
    one('creator.lead_magnet', magnet, {
      title: 'Lead magnet',
      promise: 'Title ideas and an outline for a small free checklist or guide, the sign-up blurb, the delivery email and a post to share it.',
      minutes: 8,
      tier: 'builder',
      job: 'content',
      next: [{ id: 'creator.newsletter', why: 'New sign-ups? Send them a weekly note.' }],
    }),
    one('creator.newsletter', letter, {
      title: 'Weekly newsletter',
      promise: 'Three subject lines and a short weekly email from your notes: the main thing this week, one tip, what you use and a question.',
      minutes: 6,
      tier: 'builder',
      job: 'content',
      suggestSchedule: { cron: '0 9 * * 3', label: 'Every Wednesday at 9am' },
      next: [{ id: 'creator.lead_magnet', why: 'Grow the list with a free thing.' }],
    }),
    one('creator.insights', insights, {
      title: 'Read your insights',
      promise: 'Add your Instagram or TikTok content export: top and lowest posts by your numbers, best type and day, and ideas for next week.',
      minutes: 4,
      tier: 'builder',
      job: 'money',
      next: [
        { id: 'creator.plan_month', why: 'Plan next month around what worked.' },
        { id: 'creator.media_kit', why: 'Update your media kit with this month\'s numbers.' },
      ],
    }),
  ],
};
