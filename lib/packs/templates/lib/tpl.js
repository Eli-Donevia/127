// Templates pack logic: rank buyer searches by public demand, build a template in three formats from
// one spec (a spreadsheet with working formulas, a Notion-ready page, a printable page), write the
// listing inside Etsy's limits, do the fee math per platform, and plan the product line around it.

const { text, money, files, time } = require('../../_kit');
const DEMAND = require('../data/demand.json');
const IDEAS = require('../data/ideas.json');
const PLATFORMS = require('../data/platforms.json');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const WEEKDAYS = DAYS.slice(0, 5);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const blank = (n) => Array.from({ length: n }, () => '');
const col = (i) => (i < 26 ? String.fromCharCode(65 + i) : `A${String.fromCharCode(65 + i - 26)}`);

// One spec drives all three formats. f: per-column formula with {r} for the row number. hook: the
// one line a pin or thumbnail leads with. Every formula is tested to point at real cells.
const SPECS = {
  budget: { title: 'Monthly Budget', hook: 'See where your money goes each month', sheet: true, columns: ['Category', 'Planned', 'Actual', 'Difference'], rows: ['Rent or mortgage', 'Utilities', 'Groceries', 'Transportation', 'Insurance', 'Phone and internet', 'Debt payments', 'Savings', 'Eating out', 'Subscriptions', 'Personal care', 'Gifts', 'Other'], f: { 3: '=IF(AND(B{r}="",C{r}=""),"",B{r}-C{r})' }, totals: [1, 2, 3], money: [1, 2, 3], use: 'Type what you plan to spend in Planned and what you spent in Actual. Difference and the totals fill in by themselves.' },
  bills: { title: 'Bill Tracker', hook: 'Every bill and due date on one page', sheet: true, columns: ['Bill', 'Due day', 'Amount', 'Autopay', 'Paid', 'Still owed'], rows: ['Rent or mortgage', 'Electric', 'Water', 'Gas', 'Internet', 'Phone', 'Car payment', 'Car insurance', 'Credit card', 'Streaming', 'Gym', 'Other'], f: { 5: '=IF(C{r}="","",IF(E{r}="",C{r},MAX(0,C{r}-E{r})))' }, totals: [2, 4, 5], money: [2, 4, 5], use: 'Type each bill, the day of the month it is due and the amount. When you pay, type what you paid. Still owed and the totals fill in.' },
  debt: { title: 'Debt Payoff Tracker', hook: 'See how many months each debt has left', sheet: true, columns: ['Debt', 'Balance', 'APR %', 'Monthly payment', 'Months to pay off', 'Total interest'], rows: ['Credit card 1', 'Credit card 2', 'Car loan', 'Student loan', 'Personal loan'], f: { 4: '=IF(OR(B{r}="",D{r}=""),"",IFERROR(ROUNDUP(NPER(C{r}/1200,-D{r},B{r}),0),"Pay more"))', 5: '=IF(OR(E{r}="",E{r}="Pay more"),"",ROUND(E{r}*D{r}-B{r},2))' }, totals: [1, 3, 5], money: [1, 3, 5], use: 'Type each balance, its APR and what you pay each month. Months to pay off and total interest fill in. If it says Pay more, the payment does not cover the interest.' },
  savings: { title: 'Savings Goal Tracker', hook: 'Watch every savings goal fill up', sheet: true, columns: ['Goal', 'Target', 'Saved so far', 'Left', 'Percent done', 'Monthly amount', 'Months left'], rows: ['Emergency fund', 'Vacation', 'Holiday gifts', 'New car', 'Home down payment'], f: { 3: '=IF(B{r}="","",MAX(0,B{r}-C{r}))', 4: '=IF(OR(B{r}="",B{r}=0),"",ROUND(C{r}/B{r}*100,0)&"%")', 6: '=IF(OR(F{r}="",F{r}=0,D{r}=""),"",ROUNDUP(D{r}/F{r},0))' }, totals: [1, 2, 3], money: [1, 2, 3, 5], use: 'Type a target, what you have saved and what you can add each month. Left, percent done and months left fill in.' },
  sinking: { title: 'Sinking Funds Tracker', hook: 'Ready for the bills that come once a year', sheet: true, columns: ['Fund', 'Yearly cost', 'Set aside a month', 'Saved so far', 'Still needed', 'Percent saved'], rows: ['Car repairs', 'Holidays and gifts', 'Yearly subscriptions', 'Medical', 'Vacation', 'Home repairs', 'Insurance', 'Back to school', 'Pet care'], f: { 2: '=IF(B{r}="","",ROUND(B{r}/12,2))', 4: '=IF(B{r}="","",MAX(0,B{r}-D{r}))', 5: '=IF(OR(B{r}="",B{r}=0),"",ROUND(D{r}/B{r}*100,0)&"%")' }, totals: [1, 2, 3, 4], money: [1, 2, 3, 4], use: 'Type what each fund costs in a year and what you have saved. The monthly set-aside, what is still needed and the percent saved fill in.' },
  paycheck: { title: 'Paycheck Budget', hook: 'Give every paycheck a plan', sheet: true, columns: ['Payday', 'Take-home pay', 'Bills', 'Savings', 'Spending', 'Left over'], rows: blank(12), f: { 5: '=IF(B{r}="","",B{r}-C{r}-D{r}-E{r})' }, totals: [1, 2, 3, 4, 5], money: [1, 2, 3, 4, 5], use: 'One row per paycheck: the date, the amount that landed in your account, and what goes to bills, savings and spending. Left over shows what is still unassigned.' },
  subscriptions: { title: 'Subscription Tracker', hook: 'Find the subscriptions you forgot about', sheet: true, columns: ['Service', 'Monthly cost', 'Yearly cost', 'Renews on', 'Keep or cancel'], rows: ['Streaming 1', 'Streaming 2', 'Music', 'Cloud storage', 'Phone apps', 'Gym', 'News', 'Software', 'Other'], f: { 2: '=IF(B{r}="","",B{r}*12)' }, totals: [1, 2], money: [1, 2], use: 'List every subscription and what it costs a month. The yearly cost fills in. Mark keep or cancel, and cancel before the renewal date.' },
  expense: { title: 'Expense Tracker', hook: 'Every expense in one place', sheet: true, columns: ['Date', 'Item', 'Category', 'Amount', 'Paid with', 'Running total'], rows: blank(20), f: { 5: '=IF(D{r}="","",SUM(D$2:D{r}))' }, totals: [3], money: [3, 5], use: 'One row per purchase: the date, what it was, a category and the amount. The running total and the month total fill in.' },
  networth: { title: 'Net Worth Tracker', hook: 'Your net worth, month by month', sheet: true, columns: ['Month', 'Cash and savings', 'Investments', 'Home and car value', 'Debts', 'Net worth'], rows: MONTHS, f: { 5: '=IF(AND(B{r}="",C{r}="",D{r}="",E{r}=""),"",B{r}+C{r}+D{r}-E{r})' }, totals: [], money: [1, 2, 3, 4, 5], use: 'Once a month, type what you have and what you owe. Net worth fills in, so you can see which way it moves month by month.' },
  meal: { title: 'Weekly Meal Planner', hook: 'Plan the week, shop once', columns: ['Day', 'Breakfast', 'Lunch', 'Dinner', 'Snacks'], rows: DAYS, list: 'Grocery list', use: 'Plan each day, then write the grocery list from it before you shop.' },
  cleaning: { title: 'Weekly Cleaning Schedule', hook: 'A clean house, a little each day', columns: ['Task', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], rows: ['Make beds', 'Dishes', 'Wipe kitchen counters', 'Vacuum', 'Bathroom sink and mirror', 'Laundry', 'Take out trash', 'Mop floors', 'Change sheets', 'Fridge clean-out'], use: 'Check off each task on the day you do it. Print a fresh page each week.' },
  chores: { title: 'Kids Chore Chart', hook: 'Chores kids can check off themselves', sheet: true, columns: ['Chore', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Stars'], rows: ['Make bed', 'Brush teeth', 'Put toys away', 'Feed the pet', 'Set the table', 'Homework', 'Laundry in the hamper', 'Help with dishes'], f: { 8: '=COUNTIF(B{r}:H{r},"x")' }, totals: [8], money: [], use: 'Type an x for each chore done. Stars count themselves. Print a fresh page each week for the fridge.' },
  home: { title: 'Home Maintenance Checklist', hook: 'Know when every home task is due', sheet: true, columns: ['Task', 'Every (days)', 'Last done', 'Next due', 'Days left'], rows: ['Change HVAC filter', 'Test smoke and CO alarms', 'Clean dryer vent', 'Clean gutters', 'Flush water heater', 'Check fire extinguisher', 'Clean fridge coils', 'Service lawn mower', 'Check caulk and grout', 'Clean range hood filter'], f: { 3: '=IF(OR(B{r}="",C{r}=""),"",C{r}+B{r})', 4: '=IF(D{r}="","",D{r}-TODAY())' }, totals: [], money: [], use: 'Type how often each task should happen, in days, and when you last did it. Next due and days left fill in. Your manuals say how often for your home.' },
  gifts: { title: 'Holiday Gift Tracker', hook: 'Every gift and budget on one list', sheet: true, columns: ['Person', 'Gift idea', 'Budget', 'Spent', 'Left', 'Bought', 'Wrapped'], rows: blank(15), f: { 4: '=IF(C{r}="","",C{r}-D{r})' }, totals: [2, 3, 4], money: [2, 3, 4], use: 'List everyone you buy for with a budget. Type what you spent; Left and the totals fill in. Tick Bought and Wrapped as you go.' },
  habit: { title: 'Habit Tracker', hook: 'Build habits one x at a time', sheet: true, wide: true, columns: ['Habit', ...Array.from({ length: 31 }, (_, i) => String(i + 1)), 'Days done', 'Percent'], rows: ['Drink water', 'Walk 20 minutes', 'Read 10 pages', 'In bed by 11', 'No phone at dinner', 'Stretch'], f: { 32: '=COUNTIF(B{r}:AF{r},"x")', 33: '=ROUND(AG{r}/31*100,0)&"%"' }, totals: [], money: [], use: 'Type an x on each day you did the habit. Days done and percent count themselves.' },
  workout: { title: 'Workout Log', hook: 'Log every set and see your volume', sheet: true, columns: ['Date', 'Exercise', 'Sets', 'Reps', 'Weight', 'Volume'], rows: blank(14), f: { 5: '=IF(OR(C{r}="",D{r}=""),"",C{r}*D{r}*IF(E{r}="",1,E{r}))' }, totals: [5], money: [], use: 'Log each exercise with sets, reps and weight. Volume (sets x reps x weight) and the total fill in.' },
  reading: { title: 'Reading Log', hook: 'Track every book you finish', sheet: true, columns: ['Title', 'Author', 'Pages', 'Started', 'Finished', 'Days', 'Rating (1 to 5)'], rows: blank(15), f: { 5: '=IF(OR(D{r}="",E{r}=""),"",E{r}-D{r})' }, totals: [2], money: [], use: 'Log each book with start and finish dates. Days and total pages fill in.' },
  bookkeeping: { title: 'Small Business Income and Expenses', hook: 'Income and expenses, ready for tax time', sheet: true, columns: ['Date', 'Description', 'Category', 'Income', 'Expense', 'Balance'], rows: blank(20), f: { 5: '=IF(AND(D{r}="",E{r}=""),"",SUM(D$2:D{r})-SUM(E$2:E{r}))' }, totals: [3, 4], money: [3, 4, 5], use: 'One row per sale or cost. Type it under Income or Expense and the running balance fills in. Ask a tax professional which categories you need.' },
  inventory: { title: 'Inventory Tracker', hook: 'Know when to reorder', sheet: true, columns: ['Item', 'SKU', 'In stock', 'Reorder at', 'Unit cost', 'Stock value', 'Reorder?'], rows: blank(12), f: { 5: '=IF(OR(C{r}="",E{r}=""),"",C{r}*E{r})', 6: '=IF(OR(C{r}="",D{r}=""),"",IF(C{r}<=D{r},"Reorder","OK"))' }, totals: [5], money: [4, 5], use: 'Type each item, how many you have, when to reorder and what one costs. Stock value and the reorder flag fill in.' },
  mileage: { title: 'Mileage Log', hook: 'Log every work mile as you drive it', sheet: true, columns: ['Date', 'Purpose', 'Start odometer', 'End odometer', 'Miles'], rows: blank(20), f: { 4: '=IF(OR(C{r}="",D{r}=""),"",D{r}-C{r})' }, totals: [4], money: [], use: 'Log each work trip with the odometer at the start and the end. Miles and the total fill in. Check the current mileage rate with your tax authority before you use it.' },
  content: { title: 'Content Calendar', hook: 'Plan a week of posts in one sitting', columns: ['Day', 'Platform', 'Post idea', 'Format', 'Status'], rows: DAYS, list: 'Ideas for next week', use: 'Plan one post a day, mark its status as you go, and park new ideas at the bottom.' },
  weekly: { title: 'Weekly Planner', hook: 'Your whole week on one page', columns: ['Day', 'Top 3', 'Appointments', 'To do', 'Notes'], rows: DAYS, list: "This week's goals", use: 'Write your top 3 for each day and keep appointments in one place.' },
  year: { title: 'Year at a Glance Planner', hook: 'Your whole year on one page', columns: ['Month', 'Big goal', 'Important dates', 'Bills and renewals', 'Notes'], rows: MONTHS, list: 'Goals for the year', use: 'One row per month: the big goal, the dates you can not miss and the bills that come once a year.' },
  student: { title: 'Assignment Tracker', hook: 'Every due date, counting down', sheet: true, columns: ['Class', 'Assignment', 'Due date', 'Status', 'Grade', 'Days left'], rows: blank(15), f: { 5: '=IF(C{r}="","",C{r}-TODAY())' }, totals: [], money: [], use: 'Type each assignment with its due date. Days left counts down by itself. Set Status to To do, Doing or Done.' },
  lesson: { title: 'Weekly Lesson Planner', hook: 'The school week on one page', columns: ['Day', 'Subject', 'Objective', 'Activities', 'Materials', 'Homework'], rows: WEEKDAYS, list: 'Notes for next week', use: 'Plan each school day: what students should learn, how, what they need and what goes home.' },
  wedding: { title: 'Wedding Budget and Checklist', hook: 'Every wedding cost in one place', sheet: true, columns: ['Item', 'Budget', 'Actual', 'Deposit paid', 'Balance due', 'Due date', 'Booked'], rows: ['Venue', 'Catering', 'Photographer', 'Attire', 'Flowers', 'Music or DJ', 'Cake', 'Invitations', 'Rings', 'Hair and makeup', 'Transportation', 'Favors'], f: { 4: '=IF(C{r}="","",C{r}-D{r})' }, totals: [1, 2, 3, 4], money: [1, 2, 3, 4], use: 'Set a budget for each item, then type the actual price and the deposit you paid. Balance due and the totals fill in. Mark Booked when it is confirmed.' },
  travel: { title: 'Trip Planner and Budget', hook: 'Plan the trip and the budget together', sheet: true, columns: ['Item', 'Category', 'Planned', 'Actual', 'Difference', 'Booked'], rows: ['Flights', 'Hotel', 'Car rental or trains', 'Food', 'Activities', 'Travel insurance', 'Phone plan', 'Souvenirs', 'Other'], f: { 4: '=IF(AND(C{r}="",D{r}=""),"",C{r}-D{r})' }, totals: [2, 3, 4], money: [2, 3, 4], list: 'Packing list', use: 'Plan the trip cost line by line, then type what you spent. Difference and the totals fill in. The packing list is on the printable page.' },
};

// Example rows for the pictures of templates whose rows start blank, so a mockup shows how it is
// used. Formula columns hold what the formula gives for that row. The files themselves stay blank.
const EXAMPLES = {
  paycheck: [['Oct 3', '$1,850', '$1,100', '$300', '$400', '$50'], ['Oct 17', '$1,850', '$650', '$300', '$700', '$200']],
  expense: [['Oct 1', 'Groceries', 'Food', '$64.20', 'Debit', '$64.20'], ['Oct 2', 'Gas', 'Car', '$38.00', 'Credit', '$102.20'], ['Oct 4', 'Phone bill', 'Bills', '$45.00', 'Autopay', '$147.20']],
  gifts: [['Mom', 'Scarf', '$40', '$32', '$8', 'x', ''], ['Sam', 'Board game', '$30', '', '$30', '', ''], ['Grandpa', 'Photo book', '$25', '$25', '$0', 'x', 'x']],
  workout: [['Oct 6', 'Squat', '3', '8', '95', '2,280'], ['Oct 6', 'Push-up', '3', '12', '', '36'], ['Oct 8', 'Deadlift', '3', '5', '135', '2,025']],
  reading: [['Pride and Prejudice', 'Jane Austen', '432', 'Oct 1', 'Oct 12', '11', '5'], ['Little Women', 'Louisa May Alcott', '449', 'Oct 13', '', '', '']],
  bookkeeping: [['Oct 1', 'Market sales', 'Sales', '$120.00', '', '$120.00'], ['Oct 3', 'Printer ink', 'Supplies', '', '$34.99', '$85.01'], ['Oct 9', 'Booth fee', 'Fees', '', '$25.00', '$60.01']],
  inventory: [['Candle, 8 oz', 'C-08', '24', '10', '$4.50', '$108.00', 'OK'], ['Wax melts', 'W-02', '6', '10', '$1.20', '$7.20', 'Reorder'], ['Gift box', 'G-01', '40', '15', '$0.80', '$32.00', 'OK']],
  mileage: [['Oct 2', 'Client visit', '41,210', '41,236', '26'], ['Oct 5', 'Supply run', '41,300', '41,318', '18'], ['Oct 9', 'Post office', '41,402', '41,409', '7']],
  student: [['Biology', 'Lab report', 'Oct 24', 'Doing', '', '5'], ['History', 'Essay draft', 'Oct 28', 'To do', '', '9'], ['Math', 'Problem set 4', 'Oct 20', 'Done', 'A-', '1']],
};
for (const [k, ex] of Object.entries(EXAMPLES)) SPECS[k].example = ex;

// Themes group templates that sell together (bundles) and that fit one shop (next product).
const THEMES = {
  money: { title: 'Money Planner Bundle', label: 'Money', kinds: ['budget', 'bills', 'debt', 'savings', 'sinking', 'paycheck', 'subscriptions', 'expense', 'networth'] },
  home: { title: 'Home Organizer Bundle', label: 'Home', kinds: ['cleaning', 'meal', 'chores', 'home', 'gifts'] },
  health: { title: 'Healthy Habits Bundle', label: 'Habits and health', kinds: ['habit', 'workout', 'meal', 'reading'] },
  business: { title: 'Small Business Bundle', label: 'Small business', kinds: ['bookkeeping', 'inventory', 'mileage', 'content'] },
  school: { title: 'School Year Bundle', label: 'School', kinds: ['student', 'lesson', 'reading', 'weekly'] },
  life: { title: 'Big Plans Bundle', label: 'Life plans', kinds: ['year', 'travel', 'wedding', 'gifts', 'weekly'] },
};
const THEME_IDS = Object.keys(THEMES);
const THEME_LABELS = THEME_IDS.map((t) => THEMES[t].label);
function themeIdOf(v) {
  const s = String(v || '').trim().toLowerCase();
  if (!s) return null;
  if (THEMES[s]) return s;
  return THEME_IDS.find((t) => THEMES[t].label.toLowerCase() === s || THEMES[t].title.toLowerCase() === s) || null;
}

function specOf(kind) {
  return SPECS[kind] || SPECS.weekly;
}

// Forms show template names ("Debt Payoff Tracker"); tools take a name or an id ("debt").
const KIND_TITLES = Object.keys(SPECS).map((k) => SPECS[k].title);
function kindOf(v) {
  const s = String(v || '').trim().toLowerCase();
  if (!s) return null;
  if (SPECS[s]) return s;
  return Object.keys(SPECS).find((k) => SPECS[k].title.toLowerCase() === s) || null;
}

function themeOf(kind) {
  return THEME_IDS.find((t) => THEMES[t].kinds.includes(kind)) || 'life';
}

// ---------- demand ----------

// Words too general to tell one template search from another.
const GENERIC = new Set(['template', 'templates', 'printable', 'printables', 'planner', 'planners', 'tracker', 'trackers', 'spreadsheet', 'spreadsheets', 'digital', 'notion', 'list', 'chart', 'log', 'journal', 'checklist', 'calendar', 'sheet', 'sheets', 'pdf', 'for', 'and', 'the', 'of', 'a', 'my', 'your', 'google', 'goodnotes', 'canva', 'kids']);

function keywords(search) {
  const all = String(search || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const keep = all.filter((w) => !GENERIC.has(w));
  return (keep.length ? keep : all).map((w) => (w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w));
}

// From a Gumroad Discover page (sorted by most reviewed): the listing count, the rating counts on
// the three most-rated products whose names match the search, and those products' paid prices.
// Products that only show up because they are popular (a planner bundle under "bill tracker")
// don't count.
function summarize(search, products, total) {
  const keys = keywords(search);
  const matches = (products || []).filter((p) => {
    const name = String((p && p.name) || '').toLowerCase();
    return keys.some((k) => name.includes(k));
  });
  return {
    listings: Number(total) || 0,
    top_ratings: matches.map((p) => (p.ratings && p.ratings.count) || 0).sort((a, b) => b - a).slice(0, 3),
    paid_prices: matches.slice(0, 8).map((p) => (p.price_cents || 0) / 100).filter((x) => x > 0).sort((a, b) => a - b),
    matched: matches.length,
  };
}

function scoreSearch(s) {
  const top = (s.top_ratings || []).reduce((a, b) => a + b, 0);
  const demand = Math.log10(top + 1) * 22;
  const crowd = Math.log10((s.listings || 0) + 1) * 10;
  return Math.round(Math.max(0, Math.min(100, demand - crowd + (s.kind ? 15 : 0) + 10)));
}

function priceOf(s) {
  const p = (s.paid_prices || []).filter((x) => x >= 1 && x <= 60);
  if (!p.length) return 7;
  const mid = p[Math.floor(p.length / 2)];
  return Math.max(4, Math.min(15, Math.round(mid)));
}

// A starting price for a kind: the middle of what its searches' matching products charge.
function priceFor(kind) {
  const all = [...DEMAND.searches, ...IDEAS.searches].filter((s) => s.kind === kind).flatMap((s) => s.paid_prices || []).filter((x) => x >= 1 && x <= 60).sort((a, b) => a - b);
  if (!all.length) return 7;
  return Math.max(4, Math.min(15, Math.round(all[Math.floor(all.length / 2)])));
}

const enc = (s) => encodeURIComponent(String(s || '').trim());

// Places the member can check a search themselves, today.
function checkLinks(search) {
  return {
    gumroad: `https://gumroad.com/discover?query=${enc(search)}&sort=most_reviewed`,
    etsy: `https://www.etsy.com/search?q=${enc(search)}`,
    pinterest: `https://www.pinterest.com/search/pins/?q=${enc(search)}`,
    trends: `https://trends.google.com/trends/explore?geo=US&q=${enc(search)}`,
  };
}

function searchRow(s, rank) {
  const top = (s.top_ratings || [])[0] || 0;
  const label = text.titleCase(s.search);
  const listings = (s.listings || 0).toLocaleString('en-US');
  return {
    rank,
    search: s.search,
    label,
    kind: s.kind,
    makeable: !!s.kind,
    listings: s.listings,
    top_ratings: top,
    price: priceOf(s),
    score: scoreSearch(s),
    evidence: top ? `${listings} listings on Gumroad; the most-rated match has ${top.toLocaleString('en-US')} buyer ratings` : `${listings} listings on Gumroad; none of the most-rated results match this search closely`,
    detail: s.kind ? `We can make this one: ${specOf(s.kind).title}` : 'Needs design tools, so not made here',
    url: s.url || checkLinks(s.search).gumroad,
    checked: s.checked || DEMAND.checked,
  };
}

function rankSearches(list) {
  return list
    .map((s) => searchRow(s, 0))
    .sort((a, b) => b.score - a.score)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

// ---------- the three formats ----------

function csvOf(spec) {
  const rows = [];
  const n = spec.rows.length;
  spec.rows.forEach((first, i) => {
    const r = i + 2;
    const row = {};
    spec.columns.forEach((c, j) => {
      row[c] = j === 0 ? first : spec.f && spec.f[j] ? spec.f[j].replace(/\{r\}/g, r) : '';
    });
    rows.push(row);
  });
  if (spec.totals && spec.totals.length) {
    const row = {};
    spec.columns.forEach((c, j) => {
      row[c] = j === 0 ? 'Total' : spec.totals.includes(j) ? `=SUM(${col(j)}2:${col(j)}${n + 1})` : '';
    });
    rows.push(row);
  }
  return files.csv(rows, spec.columns, { bom: true });
}

function mdOf(spec, title) {
  const head = `| ${spec.columns.join(' | ')} |\n| ${spec.columns.map(() => '---').join(' | ')} |`;
  const body = spec.rows.map((r) => `| ${[r || ' ', ...spec.columns.slice(1).map(() => ' ')].join(' | ')} |`).join('\n');
  return [
    `# ${title}`,
    '',
    spec.use,
    '',
    spec.wide ? `| Habit | Days done this month | Notes |\n| --- | --- | --- |\n${spec.rows.map((r) => `| ${r} |   |   |`).join('\n')}` : `${head}\n${body}`,
    '',
    spec.list ? `## ${spec.list}\n\n${Array.from({ length: 8 }, () => '- [ ] ').join('\n')}\n` : '',
    '## How to use this in Notion',
    '',
    '1. In Notion, open the page where you want it.',
    '2. Click the three dots at the top right, then Import, then Text and Markdown.',
    '3. Pick this file. The table becomes a Notion table you can edit.',
    '',
  ].join('\n');
}

function htmlOf(spec, title, pal) {
  const wide = spec.wide || spec.columns.length > 6;
  const css = `@page{size:letter ${wide ? 'landscape' : 'portrait'};margin:0.45in}*{box-sizing:border-box}body{font-family:Inter,Arial,sans-serif;color:${pal.ink};margin:0;padding:24px;background:#fff}h1{color:${pal.primary};margin:0 0 4px;font-size:26px}p{margin:0 0 14px;color:${pal.muted};font-size:13px}table{width:100%;border-collapse:collapse;table-layout:fixed}th{background:${pal.primary};color:${pal.onPrimary};font-size:${wide ? 9 : 12}px;padding:6px 4px;text-align:left}td{border:1px solid ${pal.line};height:${spec.rows.length > 10 ? 30 : 46}px;font-size:${wide ? 9 : 12}px;padding:4px}td:first-child{font-weight:600;background:${pal.surface}}.list{margin-top:18px}.list h2{font-size:15px;margin:0 0 6px}.line{border-bottom:1px solid ${pal.line};height:26px}@media print{body{padding:0}}`;
  const head = `<tr>${spec.columns.map((c, j) => `<th${j === 0 && wide ? ' style="width:120px"' : ''}>${files.esc(c)}</th>`).join('')}</tr>`;
  const body = spec.rows.map((r) => `<tr><td>${files.esc(r)}</td>${spec.columns.slice(1).map(() => '<td></td>').join('')}</tr>`).join('');
  const totals = spec.totals && spec.totals.length ? `<tr><td>Total</td>${spec.columns.slice(1).map(() => '<td></td>').join('')}</tr>` : '';
  const list = spec.list ? `<div class="list"><h2>${files.esc(spec.list)}</h2>${Array.from({ length: 8 }, () => '<div class="line"></div>').join('')}</div>` : '';
  return files.htmlDoc({ title, css, body: `<h1>${files.esc(title)}</h1><p>${files.esc(spec.use)}</p><table>${head}${body}${totals}</table>${list}` });
}

function importSteps(spec, title) {
  return [
    `${title}: how to open each file`,
    '',
    spec.sheet ? 'Spreadsheet (.csv, formulas included)' : 'Spreadsheet (.csv)',
    '- Google Sheets: open sheets.google.com, click Blank, then File, Import, Upload, pick the .csv, and choose Replace current sheet.',
    '- Excel: open the .csv, then Save As and pick Excel Workbook (.xlsx) so the formulas stay.',
    '- Apple Numbers: open the .csv with Numbers.',
    '',
    'Notion page (.md)',
    '- In Notion: three dots at the top right, Import, Text and Markdown, pick the .md file.',
    '',
    'Printable page (.html)',
    '- Open it in any browser, then Print. Pick Save as PDF to keep a PDF, or print it on letter paper.',
    '',
    'For personal use. Please do not resell or share the files.',
    '',
  ].join('\n');
}

// The files for one template: what goes in the Etsy zip or a bundle.
function partsOf(spec, title, pal, { folder = '' } = {}) {
  const base = text.slug(title, 40);
  const at = (n) => (folder ? `${folder}/${n}` : n);
  return [
    { name: at(`${base}-spreadsheet.csv`), data: csvOf(spec) },
    { name: at(`${base}-notion.md`), data: mdOf(spec, title) },
    { name: at(`${base}-printable.html`), data: htmlOf(spec, title, pal) },
    { name: at(`${base}-how-to-open.txt`), data: importSteps(spec, title) },
  ];
}

function formulaCount(spec) {
  return Object.keys(spec.f || {}).length * spec.rows.length + (spec.totals || []).length;
}

// ---------- listing and fees ----------

// A second search phrase per template, for tags and the title.
const ALSO = { budget: 'budget planner', bills: 'bill organizer', debt: 'debt tracker', savings: 'savings tracker', sinking: 'sinking funds', paycheck: 'paycheck planner', subscriptions: 'subscription list', expense: 'spending tracker', networth: 'net worth', meal: 'meal plan', cleaning: 'cleaning checklist', chores: 'chore chart', home: 'home maintenance', gifts: 'christmas planner', habit: 'daily habits', workout: 'fitness tracker', reading: 'book tracker', bookkeeping: 'income tracker', inventory: 'stock tracker', mileage: 'mileage tracker', content: 'social media planner', weekly: 'weekly schedule', year: 'yearly planner', student: 'homework planner', lesson: 'teacher planner', wedding: 'wedding planner', travel: 'travel planner' };
const MODIFIERS = new Set(['monthly', 'weekly', 'daily', 'yearly', 'annual', 'simple', 'minimalist', 'cute', 'aesthetic', 'editable', 'fillable', 'free', 'best', 'easy', 'new', '2026', '2027']);

// The word buyers lead with: "monthly budget" -> "budget", "notion student template" -> "student".
function headWord(search) {
  const words = String(search || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return words.find((w) => !GENERIC.has(w) && !MODIFIERS.has(w)) || words[0] || 'planner';
}

function kindOfSpec(spec) {
  return Object.keys(SPECS).find((k) => SPECS[k] === spec) || null;
}

function tagsFor(search, spec) {
  const head = headWord(search);
  const also = ALSO[kindOfSpec(spec)] || '';
  const words = [search, spec.title, `${head} template`, `${head} planner`, `${head} tracker`, also, `${head} printable`, 'google sheets', 'notion template', 'printable planner', 'digital download', 'instant download', 'spreadsheet template', 'planner pages', 'editable template', 'pdf planner'];
  const out = [];
  const max = PLATFORMS.etsy.tag_chars;
  for (const w of words) {
    // Whole words only: drop words from the end until the tag fits 20 characters.
    const ws = text.oneLine(String(w).toLowerCase()).split(' ');
    while (ws.length > 1 && (ws.join(' ').length > max || ['and', 'or', 'the', 'of', 'for', 'a', 'with', 'to'].includes(ws[ws.length - 1]))) ws.pop();
    const t = ws.join(' ');
    if (t && t.length <= PLATFORMS.etsy.tag_chars && !out.includes(t) && !/[^a-z0-9 ]/.test(t)) out.push(t);
    if (out.length >= PLATFORMS.etsy.tags_max) break;
  }
  return out;
}

// The buyer's own search first (unless the template's name already says it), a second search
// phrase, then the formats, inside Etsy's 140 characters.
function titleFor(search, spec) {
  const s = text.oneLine(String(search || '')).toLowerCase();
  const lead = !s || spec.title.toLowerCase().includes(s) ? spec.title : `${text.titleCase(s)}: ${spec.title}`;
  const also = ALSO[kindOfSpec(spec)] || '';
  let t = lead.length <= PLATFORMS.etsy.title_max ? lead : spec.title;
  const extra = also && !t.toLowerCase().includes(also) ? [text.titleCase(also)] : [];
  for (const p of [...extra, 'Printable, Google Sheets and Notion', 'Instant Download']) if (`${t}, ${p}`.length <= PLATFORMS.etsy.title_max) t = `${t}, ${p}`;
  return t;
}

// Fees on one sale at a price, per place it can sell. Gumroad's own-link fee leaves out card
// processing, so it is added here (Gumroad's fee page says so).
function feesAt(price) {
  const p = Number(price) || 0;
  const e = PLATFORMS.etsy;
  const g = PLATFORMS.gumroad;
  // Rounded like a spreadsheet's ROUND (1.305 -> 1.31), so the view and the fee calculator agree.
  const r2 = (n) => Math.round((n + 1e-9) * 100) / 100;
  const row = (platform, fee) => ({ platform, fee: p > 0 ? r2(fee) : 0, keep: p > 0 ? r2(p - r2(fee)) : 0 });
  const etsy = e.listing_fee + p * (e.transaction_rate + e.processing_rate) + e.processing_fixed;
  return [
    row('Etsy, normal sale', etsy),
    row('Etsy, sale from an Offsite Ad', etsy + p * e.offsite_ads_rate),
    row('Gumroad, your own link', p * (g.direct_rate + g.card_rate) + g.direct_fixed + g.card_fixed),
    row('Gumroad, Discover marketplace', p * g.discover_rate),
  ];
}

const FEE_NOTES = [
  'Etsy: $0.20 listing fee (charged again each time a listing with more than one available sells), 6.5% transaction fee, 3% + $0.25 US payment processing, and 15% on sales that come from Etsy Offsite Ads.',
  'Gumroad: 10% + $0.50 on sales through your own link, plus card processing of 2.9% + $0.30; a flat 30% on sales through Gumroad Discover, processing included.',
  'Checked 2026-10-19 on Etsy and Gumroad help pages. Fees change: check them before you list.',
];

// A fee calculator the member keeps: change a price and every fee and payout updates.
function feeCalculatorCsv(rows) {
  const e = PLATFORMS.etsy;
  const g = PLATFORMS.gumroad;
  const out = rows.map((r, i) => {
    const n = i + 2;
    return {
      Product: r.product,
      Price: r.price,
      'Etsy fees': `=IF(B${n}=0,0,ROUND(${e.listing_fee}+B${n}*${money.round(e.transaction_rate + e.processing_rate, 3)}+${e.processing_fixed},2))`,
      'Etsy you keep': `=B${n}-C${n}`,
      'Etsy Offsite Ad fees': `=IF(B${n}=0,0,ROUND(C${n}+B${n}*${e.offsite_ads_rate},2))`,
      'Etsy Offsite Ad you keep': `=B${n}-E${n}`,
      'Gumroad link fees': `=IF(B${n}=0,0,ROUND(B${n}*${money.round(g.direct_rate + g.card_rate, 3)}+${money.round(g.direct_fixed + g.card_fixed, 2)},2))`,
      'Gumroad link you keep': `=B${n}-G${n}`,
      'Gumroad Discover fees': `=ROUND(B${n}*${g.discover_rate},2)`,
      'Gumroad Discover you keep': `=B${n}-I${n}`,
    };
  });
  out.push({}, ...FEE_NOTES.map((n) => ({ Product: n })));
  return files.csv(out, ['Product', 'Price', 'Etsy fees', 'Etsy you keep', 'Etsy Offsite Ad fees', 'Etsy Offsite Ad you keep', 'Gumroad link fees', 'Gumroad link you keep', 'Gumroad Discover fees', 'Gumroad Discover you keep'], { bom: true });
}

// ---------- the product line ----------

// Prices for the line around one template: a free sample page, the template, a printable-only
// version, and a bundle of three from the same theme. Prices come from what matching products
// charge on Gumroad (priceFor), never from what anyone earns.
function ladder(kind, { price, theme } = {}) {
  const spec = specOf(kind);
  const core = Math.max(2, Math.round(Number(price) || priceFor(kind)));
  const th = THEMES[theme] ? theme : themeOf(kind);
  const bundleKinds = [kind, ...THEMES[th].kinds.filter((k) => k !== kind)].slice(0, 3);
  const singles = bundleKinds.reduce((s, k) => s + (k === kind ? core : priceFor(k)), 0);
  const bundle = Math.max(core + 2, money.nicePrice(singles * 0.65));
  const printable = Math.max(1, Math.min(core - 1, Math.round(core * 0.5)));
  const launch = Math.max(1, core - Math.max(1, Math.round(core * 0.25)));
  return { spec, core, printable, bundle, bundleKinds, singles, launch, theme: th };
}

// ---------- the 14-day launch ----------

function launchDays(start) {
  const plan = [
    [0, 'List the template on Etsy (and Gumroad if you use it) with the title, tags and description from this kit. Add the mockup as the first photo.'],
    [0, 'Send the note to 5 people you know who would use it. Ask what was confusing, not for a review.'],
    [1, 'Post pin 1 on Pinterest with its title, description and alt text, linking to your listing.'],
    [3, 'Post pin 2. Fix anything your 5 people found confusing and update the files.'],
    [5, 'Post pin 3.'],
    [6, 'Send the launch email to your list, if you have one.'],
    [9, 'Look at the listing stats: views, favorites, sales. Views but no favorites: change the first photo. No views: rewrite the title and the first tags around one search.'],
    [13, 'Decide: keep it as it is, change the price, or start the next template (Your next product).'],
  ];
  return plan.map(([d, task]) => ({ day: d + 1, date: time.addDays(start, d), task }));
}

module.exports = { ALSO, headWord, SPECS, THEMES, THEME_IDS, THEME_LABELS, KIND_TITLES, kindOf, themeIdOf, DEMAND, IDEAS, PLATFORMS, FEE_NOTES, DAYS, MONTHS, specOf, themeOf, keywords, summarize, scoreSearch, priceOf, priceFor, checkLinks, searchRow, rankSearches, csvOf, mdOf, htmlOf, importSteps, partsOf, formulaCount, tagsFor, titleFor, feesAt, feeCalculatorCsv, ladder, launchDays, col };
