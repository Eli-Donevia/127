// Life in HQ (flag HQ_LIFE, lib/harness/flags.js): modules for the member's life outside the business. Budget, a
// workout planner, a food log, a daily check-in, and Faith (Bible reading plans, prayer and reading blocks for the
// member's calendar), drawn by public/js/life/<id>.js.
//
// 127 stores none of it. Everything a member types stays in their own browser (localStorage, one key per member and
// module, see scope()); they can export it as a file, bring it back on another device, and delete it from the device.
// There are no save routes, nothing is sent to AI, and nothing here calls another service. The exercise list
// (public/life/exercises.json), the starter foods (content/life/foods.json) and the Bible's book and chapter list
// (content/life/bible.json) ship with the site.
//
// Health and faith data are sensitive under several privacy laws, so those modules are held: `held: true` modules open for members only once Legal clears them by id in LIFE_CLEARED
// (comma separated, e.g. LIFE_CLEARED=food,body,faith). Admins can open a held module as a preview. Until then a member
// sees a short "on the way" card and the page's script is never sent.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MODULES = [
  {
    id: 'budget', title: 'Budget', tier: 'builder', held: false, art: 'budget',
    line: 'Give every dollar a job for the month, log what you spend, and see what is left in each envelope.',
  },
  {
    id: 'train', title: 'Workout planner', tier: 'builder', held: false, art: 'train',
    line: 'Pick your days, time and equipment. Get a week of workouts from 800+ exercises, each with how-to steps.',
  },
  {
    id: 'food', title: 'Food log', tier: 'builder', held: true, art: 'food',
    line: 'Set your own daily target, log meals from a starter list or your own foods, and watch the week.',
  },
  {
    id: 'body', title: 'Daily check-in', tier: 'builder', held: true, art: 'body',
    line: 'Sleep, water, steps, energy and weight in ten seconds a day, with your 30-day trend.',
  },
  {
    id: 'faith', title: 'Faith', tier: 'builder', held: true, art: 'faith',
    line: 'Read the Bible on a plan that fits your week, and put prayer and reading time on your calendar.',
  },
];

// Apps a member runs on their own account and connects to their own Claude. 127 links to them and holds nothing.
// `license` is the project's own; `cost` is what the member pays the app, if anything.
const BRING = {
  budget: [
    { name: 'Actual Budget', url: 'https://actualbudget.org', license: 'MIT, open source', cost: 'Free to run yourself',
      line: 'A full envelope budgeting app you host yourself. Export from here as CSV and import it there when you want sync across devices.' },
    { name: 'SimpleFIN Bridge', url: 'https://bridge.simplefin.org', license: 'Paid service', cost: 'About $15 a year, paid to them',
      line: 'Pulls your bank transactions into Actual Budget once a day. Your bank login goes to them, never to 127.' },
    { name: 'Your own money connectors', url: 'https://claude.ai/settings/connectors', license: 'Run by each company', cost: 'Comes with your Claude plan',
      line: 'Stripe, QuickBooks and Mercury each run an official connector. Add them to your own Claude to ask about your own accounts.' },
  ],
  train: [
    { name: 'Free Exercise DB', url: 'https://github.com/yuhonas/free-exercise-db', license: 'Public domain (Unlicense)', cost: 'Free',
      line: 'Where the planner\'s exercises come from. Browse photos of every movement on their site.' },
    { name: 'wger', url: 'https://wger.de', license: 'AGPL, open source', cost: 'Free',
      line: 'A full workout and weight log you can host yourself, with a phone app, if you want to track every set.' },
  ],
  food: [
    { name: 'USDA FoodData Central', url: 'https://fdc.nal.usda.gov', license: 'Public domain', cost: 'Free',
      line: 'Look up any food the starter list doesn\'t have, then add it here as your own.' },
    { name: 'Open Food Facts', url: 'https://world.openfoodfacts.org', license: 'Open data (ODbL)', cost: 'Free',
      line: 'Search packaged foods by name or barcode to get the numbers off the label.' },
  ],
  body: [],
  faith: [
    { name: 'Bible Gateway', url: 'https://www.biblegateway.com', license: 'Free to read', cost: 'Free',
      line: 'Where each day\'s reading opens, in the translation you pick. ESV, NIV and NLT read there under their own licenses.' },
    { name: 'eBible.org', url: 'https://ebible.org', license: 'Public domain and open translations', cost: 'Free',
      line: 'Download the World English Bible and other free translations to read offline.' },
    { name: 'YouVersion', url: 'https://www.bible.com', license: 'Free app', cost: 'Free',
      line: 'The Bible app on your phone, with audio, if you want to listen on the drive.' },
  ],
};

// What to paste into the member's own Claude to build a bigger version for themselves.
const PROMPTS = {
  budget: 'Build me a monthly budget app as an artifact. Ask me first for my take-home pay, my fixed bills and the categories I spend on. Then give every dollar a category, let me log spending by category, show what is left in each, and warn me before a category runs out. Keep it to one screen that works on my phone.',
  train: 'Build me a workout plan as an artifact. Ask me how many days a week I can train, how long each session can be, what equipment I have, and what I want out of it. Then lay out each day with exercises, sets, reps and rest, with a one-line cue for each move, and a way to tick off what I did. Keep it general fitness, not medical advice.',
  food: 'Build me a simple food log as an artifact. Let me set my own daily calorie and protein targets, add foods with calories, protein, carbs and fat, and show today against my targets plus the last seven days. Keep my entries in the artifact only.',
  faith: 'Build me a Bible reading plan as an artifact. Ask me which books I want to read, how many days I have and which days of the week I read. Lay out each day\'s chapters, let me tick them off, show how far along I am, and help me catch up if I miss a day without starting over.',
  body: 'Build me a daily check-in as an artifact: sleep hours, water, steps, energy from 1 to 5 and an optional weight. One tap per field, then show my 7-day averages and a 30-day line for each. Keep my entries in the artifact only.',
};

const cleared = () => new Set(String(process.env.LIFE_CLEARED || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));

function list() { return MODULES; }
function get(id) { return MODULES.find((m) => m.id === id) || null; }
// Open for members: not held, or held and cleared by Legal.
function isClear(m) { return !!m && (!m.held || cleared().has(m.id)); }

// The browser storage key's member part: a one-way hash of the member's id, so two people on one computer don't
// see each other's entries and the id itself isn't written to the device.
function scope(userId) { return crypto.createHash('sha256').update(`127-life:${userId}`).digest('hex').slice(0, 16); }

const cache = {};
const content = (name) => cache[name] || (cache[name] = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'content', 'life', `${name}.json`), 'utf8')));
const starterFoods = () => content('foods');
// Book order, chapter counts and the reading plans (Faith). No Bible text: readings open on Bible Gateway.
const bible = () => content('bible');

module.exports = { list, get, isClear, scope, starterFoods, bible, BRING, PROMPTS, MODULES };
