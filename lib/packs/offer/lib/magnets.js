// "Make a freebie to give away": three kinds that work for a first business. One that
// shows a problem (a self-check people score in five minutes), one step of what you do (a
// calculator or a fill-in template), or a real sample (a claim card for a free or starter first
// job). Each is a finished file the member can share today, plus the post that promotes it, the
// keyword people send, the reply that delivers it and the follow-up two days later.

const { text, money, time } = require('../../_kit');
const { cap, ctaOf, a } = require('./facts');
const { promiseShort } = require('./library');
const { Sheet } = require('./sheet');
const page = require('./page');
const DATA = require('../data/magnets.json');
const { ARCH } = require('./niches');

const esc = page.esc;

function checklistOf(f) {
  const arch = ARCH[f.arch] || {};
  return DATA.checklists[f.profile.checklist] || DATA.checklists[arch.checklist] || DATA.checklists.home;
}

function calcIdOf(f) {
  return f.profile.calc || 'diy_vs_pro';
}

function templateIdOf(f) {
  return f.profile.template || 'weekly_plan';
}

function countItems(cl) {
  return cl.groups.reduce((n, g) => n + g.items.length, 0);
}

// The ideas, one of each kind (a calculator and a template when both fit), best fit first.
function ideas(f) {
  const cl = checklistOf(f);
  const n = countItems(cl);
  const calcId = calcIdOf(f);
  const tplId = templateIdOf(f);
  const calc = DATA.calculators[calcId];
  const tpl = templateTitle(tplId, f);
  const at = f.profile.attraction || {};
  const claimTitle = text.plain(String(at.title || 'Free first visit').replace(/\{unit\}/g, f.unit));
  const out = [
    {
      id: 'checklist',
      kind: 'checklist',
      title: cl.title,
      type: 'Shows them a problem',
      what: `${n} things to check on ${cl.subject}, scored in about ${cl.minutes} minutes. Every box they can't tick is a reason to call you.`,
      why: 'People who score low just found out they need you. Easy to share, and it prints on one page.',
      files: 'A checklist people tick on their phone or print (HTML)',
      keyword: 'CHECK',
    },
  ];
  if (calc) {
    out.push({
      id: `calc:${calcId}`,
      kind: 'calculator',
      title: calc.title,
      type: 'Gives them one step of what you do',
      what: calc.lede,
      why: 'Useful on its own, and it shows you know the job. The next step is hiring you.',
      files: 'A spreadsheet with working formulas (CSV for Google Sheets or Excel)',
      keyword: 'CALC',
    });
  }
  if (DATA.templates[tplId]) {
    out.push({
      id: `tpl:${tplId}`,
      kind: 'template',
      title: tpl,
      type: 'Gives them one step of what you do',
      what: `A ${tpl.toLowerCase()} they can print or fill in, made for ${f.who}.`,
      why: 'People keep it, use it and see your name on it every time.',
      files: 'A printable page (HTML) and a spreadsheet version (CSV)',
      keyword: 'PLAN',
    });
  }
  out.push({
    id: 'claim',
    kind: 'claim',
    title: claimTitle,
    type: 'Lets them try the real thing',
    what: `${buyerWhat(at, f)}.`,
    why: 'The fastest way to a first yes: they try you with almost no risk.',
    files: 'Printable claim cards, 8 to a page (HTML)',
    keyword: 'FIRST',
  });
  // Online and teaching businesses lead with a useful tool; local services with the check.
  if (['digital', 'product', 'food', 'teach'].includes(f.arch) && out[1] && out[1].kind !== 'claim') out.unshift(out.splice(1, 1)[0]);
  return out.map((x, i) => ({ ...x, rank: i + 1, label: x.title, detail: `${x.type}. ${x.what}` }));
}

// The attraction offer as a buyer reads it: no strategy notes, second person.
function buyerWhat(at, f) {
  return text
    .plain(String(at.what || 'A smaller first job').replace(/\{unit\}/g, f.unit))
    .replace(/,? shown next to [^.]*$/i, '')
    .replace(/\btheirs\b/g, 'yours')
    .replace(/\btheir\b/g, 'your')
    .replace(/\bthey\b/g, 'you')
    .replace(/\bthem\b/g, 'you')
    .replace(/[.]$/, '');
}

function templateTitle(id, f) {
  const t = DATA.templates[id];
  if (!t) return 'Weekly plan';
  if (t.variants) {
    const v = t.variants[f.profile.nicheId] || t.variants.default;
    return v.title;
  }
  return t.title;
}

// ---------- the checklist ----------

const CHECK_CSS = `
.cl{counter-reset:done}
.cl .group{margin-top:22px}
.cl .group h3{font-size:15px;letter-spacing:.08em;text-transform:uppercase;color:var(--primary);margin-bottom:6px}
.cl .card{padding:4px 0}
.cl input:checked+.box{counter-increment:done}
.score{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-top:24px;background:var(--deep);color:var(--on-deep);border-radius:20px;padding:20px 22px;break-inside:avoid}
.score .count{font-size:44px;font-weight:850;letter-spacing:-0.03em;line-height:1}
.score .count:after{content:counter(done)}
.score .of{font-size:15px;opacity:.8}
.bands{margin-top:14px}
.bands .band{display:flex;gap:12px;align-items:baseline;padding:8px 0;border-bottom:1px dashed var(--line)}
.bands .band b{min-width:84px;font-size:15px}
@media print{.score .count:after{content:"____"}}
`;

function checklistHtml(f, offer) {
  const cl = checklistOf(f);
  const n = countItems(cl);
  const groups = cl.groups
    .map((g) => `<div class="group"><h3>${esc(g.name)}</h3><div class="card">${g.items.map(([t, why]) => `<label class="check"><input type="checkbox"><span class="box"></span><span class="txt">${esc(t)}${why ? `<span class="why">${esc(why)}</span>` : ''}</span></label>`).join('')}</div></div>`)
    .join('');
  const bands = cl.bands.map(([min, line], i) => `<div class="band"><b>${i === 0 ? `${min} to ${n}` : i === cl.bands.length - 1 ? `0 to ${cl.bands[i - 1][0] - 1}` : `${min} to ${cl.bands[i - 1][0] - 1}`}</b><span>${esc(line)}</span></div>`).join('');
  const who = f.business || f.firstName || '';
  const body = [
    page.hero({ eyebrow: who ? `Free from ${who}` : 'Free checklist', title: cl.title, lede: `Tick everything that's true about ${cl.subject} right now. It takes about ${cl.minutes} minutes.`, pills: [`${n} points`, `${cl.minutes} minutes`, 'Tap or print'] }),
    `<div class="cl">${groups}<div class="score"><div><div class="eyebrow" style="color:inherit;opacity:.8">Your score</div><div><span class="count"></span> <span class="of">of ${n}</span></div></div><div class="small" style="max-width:34ch;opacity:.9">Every box you couldn't tick is something to fix. The lowest group is where to start.</div></div></div>`,
    page.section('What your score means', `<div class="bands">${bands}</div>`),
    page.cta(`Want it all handled${f.mobile ? ' at your place' : ''}?`, `${offer && offer.line ? `${offer.line} ` : ''}${promiseShort(f.profile.promise)}`, ctaOf(f)),
    page.foot(who ? `${who}${f.place ? ` · ${f.place}` : ''}` : '', 'Share it with anyone it would help.'),
  ].join('\n');
  return page.doc({ title: cl.title, description: `${n} things to check on ${cl.subject}.`, pal: f.palette, body, extra: CHECK_CSS });
}

// ---------- calculators (CSV with formulas) ----------

function calcCsv(id, f) {
  const sh = new Sheet();
  const calc = DATA.calculators[id] || DATA.calculators.diy_vs_pro;
  sh.add([calc.title, '', '']);
  sh.add([calc.lede, '', '']);
  sh.blank();
  if (id === 'grade') {
    sh.add(['Your numbers', 'Value', 'Notes']);
    sh.add(['Your grade right now (%)', 82, 'From your school portal'], 'now');
    sh.add(['How much the final counts (%)', 20, 'Ask the teacher or check the syllabus'], 'w');
    sh.add(['The grade you want (%)', 85, ''], 'want');
    sh.blank();
    sh.add(['Answer', '', '']);
    sh.add(['Score you need on the final (%)', `=ROUND((${sh.ref('want')}-${sh.ref('now')}*(1-${sh.ref('w')}/100))/(${sh.ref('w')}/100),1)`, 'Over 100 means aim for a lower grade, or ask about extra credit'], 'need');
    sh.blank();
    sh.add(['If you want...', 'You need on the final (%)', '']);
    for (const g of [70, 75, 80, 85, 90, 95]) sh.add((r) => [g, `=ROUND((A${r}-${sh.ref('now')}*(1-${sh.ref('w')}/100))/(${sh.ref('w')}/100),1)`, '']);
  } else if (id === 'practice') {
    sh.add(['Your numbers', 'Value', 'Notes']);
    sh.add(['Minutes a day', 20, ''], 'min');
    sh.add(['Days a week', 5, ''], 'days');
    sh.add(['Weeks', 12, ''], 'weeks');
    sh.blank();
    sh.add(['Answer', '', '']);
    sh.add(['Hours of practice in total', `=ROUND(${sh.ref('min')}*${sh.ref('days')}*${sh.ref('weeks')}/60,1)`, ''], 'hours');
    sh.add(['Practice sessions in total', `=${sh.ref('days')}*${sh.ref('weeks')}`, ''], 'sessions');
    sh.add(['Hours if you only practice on weekends', `=ROUND(${sh.ref('min')}*2*${sh.ref('weeks')}/60,1)`, 'Two days a week, same minutes']);
  } else if (id === 'time_saved') {
    sh.add(['Your numbers', 'Value', 'Notes']);
    sh.add(['Hours a week you spend on it', 4, 'Be honest, include the small stuff'], 'hrs');
    sh.add(['What an hour of your time is worth', 50, 'What you could do with that hour instead'], 'rate');
    sh.add(['Weeks in a month', 4.33, ''], 'weeks');
    sh.add([`Price to hand it off (a ${f.unit === 'month' ? 'month' : f.unit})`, f.price || 0, f.price ? 'My price' : 'Type the price you were quoted'], 'price');
    sh.blank();
    sh.add(['Answer', '', '']);
    sh.add(['Hours a month you spend on it', `=ROUND(${sh.ref('hrs')}*${sh.ref('weeks')},1)`, ''], 'month');
    sh.add(['What those hours are worth a month', `=ROUND(${sh.ref('month', 'B')}*${sh.ref('rate')},2)`, ''], 'cost');
    sh.add(['Your time cost minus the price', `=ROUND(${sh.ref('cost', 'B')}-${sh.ref('price')},2)`, 'Above zero means handing it off costs less than your time']);
  } else if (id === 'gift_budget') {
    sh.add(['Person', 'Gift idea', 'Budget', 'Spent', 'Left', 'Bought? (yes or no)']);
    const first = sh.rows.length + 1;
    const people = [['Mom', '', 60, 0], ['Dad', '', 60, 0], ['Best friend', '', 40, 0], ['Coworker', '', 20, 0], ['', '', '', ''], ['', '', '', ''], ['', '', '', ''], ['', '', '', ''], ['', '', '', ''], ['', '', '', '']];
    for (const p of people) sh.add((r) => [p[0], p[1], p[2], p[3], `=IF(C${r}="","",C${r}-D${r})`, '']);
    const last = sh.rows.length;
    sh.blank();
    sh.add(['Total budget', '', `=SUM(C${first}:C${last})`, '', '', '']);
    sh.add(['Total spent', '', `=SUM(D${first}:D${last})`, '', '', '']);
    sh.add(['Left to spend', '', `=SUM(C${first}:C${last})-SUM(D${first}:D${last})`, '', '', '']);
    sh.add(['Gifts bought', '', `=COUNTIF(F${first}:F${last},"yes")`, '', '', '']);
  } else if (id === 'party_order') {
    sh.add(['Your numbers', 'Value', 'Notes']);
    sh.add(['Guests', 20, ''], 'guests');
    sh.add(['Pieces per guest', 2, 'A starting guess. Change it'], 'per');
    sh.add(['Extra for seconds (%)', 15, ''], 'extra');
    sh.add(['Pieces in one order', 12, 'A dozen, unless I tell you otherwise'], 'pack');
    sh.add([`Price per order`, f.price || 0, f.price ? 'My price' : 'Type the price'], 'price');
    sh.blank();
    sh.add(['Answer', '', '']);
    sh.add(['Pieces to order', `=ROUND(${sh.ref('guests')}*${sh.ref('per')}*(1+${sh.ref('extra')}/100)+0.49,0)`, ''], 'pieces');
    sh.add(['Orders to place', `=CEILING(${sh.ref('pieces', 'B')}/${sh.ref('pack')},1)`, ''], 'orders');
    sh.add(['Total price', `=${sh.ref('orders', 'B')}*${sh.ref('price')}`, '']);
  } else {
    const d = { ...calc.defaults, ...(calc.byNiche && calc.byNiche[f.profile.nicheId] ? calc.byNiche[f.profile.nicheId] : {}) };
    const job = d.job || `do the ${f.unit} yourself`.replace('the visit', 'job');
    sh.add(['Your numbers', 'Value', 'Notes']);
    sh.add([`Hours it takes you to ${job}`, d.hours, 'Include setup and cleanup'], 'hours');
    sh.add(['What an hour of your time is worth', d.rate, 'What you could do with that hour instead'], 'rate');
    sh.add(['Supplies you buy each time', d.supplies, 'A starting guess. Change it'], 'supplies');
    sh.add(['Times a year', d.times, ''], 'times');
    sh.add([`Price to have it done`, f.price || 0, f.price ? 'My price' : 'Type the price you were quoted'], 'price');
    sh.blank();
    sh.add(['Answer', '', '']);
    sh.add(['Doing it yourself, each time', `=ROUND(${sh.ref('hours')}*${sh.ref('rate')}+${sh.ref('supplies')},2)`, 'Your time plus supplies'], 'diy');
    sh.add(['Doing it yourself, a year', `=ROUND(${sh.ref('diy', 'B')}*${sh.ref('times')},2)`, ''], 'diyYear');
    sh.add(['Having it done, a year', `=ROUND(${sh.ref('price')}*${sh.ref('times')},2)`, ''], 'proYear');
    sh.add(['Hours a year you get back', `=ROUND(${sh.ref('hours')}*${sh.ref('times')},1)`, '']);
    sh.add(['Difference a year', `=ROUND(${sh.ref('diyYear', 'B')}-${sh.ref('proYear', 'B')},2)`, 'Above zero means having it done costs less than your time']);
  }
  sh.blank();
  const by = f.business || f.firstName;
  sh.add([by ? `Made by ${by}. ${ctaOf(f)}.` : `${ctaOf(f)}.`, '', '']);
  return sh.csv();
}

// ---------- templates (printable HTML + CSV) ----------

const TPL_CSS = `
.sheet{background:#fff;border:1px solid var(--line);border-radius:18px;padding:18px;break-inside:avoid}
.sheet table{width:100%;border-collapse:collapse;font-size:14px}
.sheet th{background:var(--soft);text-align:left;padding:8px 10px;font-size:12px;letter-spacing:.06em;text-transform:uppercase}
.sheet td{border-top:1px solid var(--line);padding:10px;height:38px;vertical-align:top}
.field{margin-bottom:14px}
.field .lbl{font-size:12.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-bottom:6px}
.season h3{color:var(--primary);margin-bottom:8px}
.cards8{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.ccard{border:2px dashed var(--line);border-radius:16px;padding:16px;background:#fff;break-inside:avoid}
.ccard h3{font-size:18px;margin-bottom:6px}
@media (max-width:640px){.cards8{grid-template-columns:1fr}}
`;

function templateHtml(id, f, offer) {
  const t = DATA.templates[id] || DATA.templates.weekly_plan;
  const who = f.business || f.firstName || '';
  const title = templateTitle(id, f);
  let inner = '';
  let csvRows = [];
  if (id === 'home_schedule') {
    const v = t.variants[f.profile.nicheId] || t.variants.default;
    const order = f.season === 'fall' ? ['fall', 'winter', 'spring', 'summer'] : f.season === 'winter' ? ['winter', 'spring', 'summer', 'fall'] : f.season === 'spring' ? ['spring', 'summer', 'fall', 'winter'] : ['summer', 'fall', 'winter', 'spring'];
    inner = page.grid(order.map((s) => `<div class="sheet season"><h3>${esc(text.titleCase(s))}</h3>${v.seasons[s].map((x) => `<label class="check"><input type="checkbox"><span class="box"></span><span class="txt">${esc(x)}</span></label>`).join('')}<div class="field" style="margin-top:10px"><div class="lbl">Done on</div><div class="fill"></div></div></div>`), 2);
    csvRows = [['Season', 'Job', 'Done on'], ...order.flatMap((s) => v.seasons[s].map((x) => [text.titleCase(s), x, '']))];
  } else if (id === 'prep_sheet' || id === 'pet_sheet' || id === 'order_form') {
    inner = `<div class="sheet">${t.fields.map((x) => `<div class="field"><div class="lbl">${esc(x)}</div><div class="fill"></div><div class="fill"></div></div>`).join('')}</div>`;
    csvRows = [['Question', 'Your answer'], ...t.fields.map((x) => [x, ''])];
  } else if (id === 'weekly_plan') {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    inner = `<div class="field"><div class="lbl">This week's one goal</div><div class="fill"></div></div><div class="sheet"><table><thead><tr><th>Day</th>${t.rows.map((r) => `<th>${esc(r)}</th>`).join('')}</tr></thead><tbody>${days.map((d) => `<tr><td><b>${d}</b></td>${t.rows.map(() => '<td></td>').join('')}</tr>`).join('')}</tbody></table></div><div class="field" style="margin-top:16px"><div class="lbl">What worked this week</div><div class="fill"></div><div class="fill"></div></div>`;
    csvRows = [['Day', ...t.rows], ...days.map((d) => [d, ...t.rows.map(() => '')])];
  } else if (id === 'posting_plan') {
    const start = time.nextWeekday(f.today, 1, { after: true });
    const rows = Array.from({ length: 30 }, (_, i) => ({ day: i + 1, date: time.shortDate(time.addDays(start, i)), type: t.types[i % t.types.length] }));
    inner = `<div class="sheet"><table><thead><tr><th>Day</th><th>Date</th><th>Post</th><th>Idea</th><th>Done</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${r.day}</td><td>${esc(r.date)}</td><td>${esc(r.type)}</td><td></td><td></td></tr>`).join('')}</tbody></table></div>`;
    csvRows = [['Day', 'Date', 'Post', 'Idea', 'Done'], ...rows.map((r) => [r.day, r.date, r.type, '', ''])];
  } else if (id === 'care_card') {
    const v = t.variants[f.profile.nicheId] || t.variants.default;
    const card = `<div class="ccard"><div class="eyebrow">${esc(who || 'Care card')}</div><h3>${esc(v.title)}</h3><ol class="small" style="margin:6px 0 8px 18px;padding:0">${v.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol><div class="tiny muted">${esc(ctaOf(f))}</div></div>`;
    inner = `<div class="cards8">${Array.from({ length: 4 }, () => card).join('')}</div>`;
    csvRows = [['Step', 'What to do'], ...v.steps.map((s, i) => [i + 1, s])];
  } else if (id === 'meal_plan') {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    inner = `<div class="sheet"><table><thead><tr><th>Day</th>${t.meals.map((m) => `<th>${esc(m)}</th>`).join('')}</tr></thead><tbody>${days.map((d) => `<tr><td><b>${d}</b></td>${t.meals.map(() => '<td></td>').join('')}</tr>`).join('')}</tbody></table></div><div class="field" style="margin-top:16px"><div class="lbl">Shopping list</div><div class="fill"></div><div class="fill"></div><div class="fill"></div></div>`;
    csvRows = [['Day', ...t.meals], ...days.map((d) => [d, ...t.meals.map(() => '')])];
  }
  const body = [
    page.hero({ eyebrow: who ? `Free from ${who}` : 'Free template', title, lede: `Print it, or fill it in on your phone.`, pills: [f.city ? f.city : ''].filter(Boolean) }),
    `<div class="section">${inner}</div>`,
    page.cta(offer && offer.line ? offer.line : `Want a hand with it?`, promiseShort(f.profile.promise), ctaOf(f)),
    page.foot(who, 'Share it with anyone it would help.'),
  ].join('\n');
  const { files } = require('../../_kit');
  return { html: page.doc({ title, pal: f.palette, body, extra: TPL_CSS }), csv: files.csv(csvRows.slice(1).map((r) => Object.fromEntries(r.map((v, i) => [`c${i}`, v]))), csvRows[0].map((h, i) => ({ key: `c${i}`, label: h })), { bom: true }), title };
}

// ---------- claim cards for a free or starter first job ----------

function claimHtml(f, { limit } = {}) {
  const at = f.profile.attraction || {};
  const free = at.price === 0;
  const title = text.plain(String(at.title || 'Free first visit').replace(/\{unit\}/g, f.unit));
  const price = !free && f.price ? money.usd(money.nicePrice(f.price * (at.price || 0.5))) : '';
  const what = buyerWhat(at, f);
  const who = f.business || f.firstName || '';
  const lim = limit ? `For my first ${limit} ${f.customers}.` : 'One per household.';
  const card = `<div class="ccard"><div class="eyebrow">${esc(who || 'Claim card')}</div><h3>${esc(title)}${price ? ` <span style="color:var(--primary)">${esc(price)}</span>` : ''}</h3><p class="small">${esc(what)}.</p><p class="small" style="margin-top:8px"><b>${esc(ctaOf(f, 'FIRST'))}</b></p><p class="tiny muted" style="margin-top:6px">${esc(lim)} ${esc(promiseShort(f.profile.promise))}</p></div>`;
  const body = [
    `<div class="hide-print">${page.hero({ eyebrow: 'Print, cut and hand out', title, lede: 'Eight cards to a page. Leave them where your buyers are, or post one as a photo.', pills: [lim] })}</div>`,
    `<div class="section cards8">${Array.from({ length: 8 }, () => card).join('')}</div>`,
  ].join('\n');
  return { html: page.doc({ title: `${title} claim cards`, pal: f.palette, body, extra: TPL_CSS, margin: '0.35in' }), title, price, what, free };
}

// ---------- the promo kit ----------

function promo(f, idea, { keyword } = {}) {
  const kw = (keyword || idea.keyword || 'FREE').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'FREE';
  const cl = checklistOf(f);
  const n = countItems(cl);
  const where = f.place ? ` in ${f.city || f.place}` : '';
  const ask = f.instagram ? `Comment ${kw} and I'll DM it to you.` : f.phone ? `Text ${kw} to ${f.phone} and I'll send it.` : `Message me ${kw} and I'll send it.`;
  const lines = {
    checklist: [`I made a free ${cl.title.replace(/^The /, '')}: ${n} things to check on ${cl.subject}, in about ${cl.minutes} minutes.`, `Score yourself, then you'll know exactly what needs fixing first.`],
    calculator: [`I made a free calculator for ${f.who}: ${idea.title}${/[?.!]$/.test(idea.title) ? '' : '.'}`, 'Type your own numbers and the sheet does the math.'],
    template: [`I made a free ${idea.title.toLowerCase()} you can print or fill in on your phone.`, `Made for ${f.who}.`],
    claim: [`${idea.title}${where}: ${text.oneLine(idea.what).replace(/\.$/, '')}.`, 'An easy way to try me.'],
  }[idea.kind] || [`I made something free for ${f.who}.`, ''];
  const post = text.plain(`${lines[0]} ${lines[1]}\n\n${idea.kind === 'claim' ? `${ctaOf(f, kw)} to claim yours.` : ask}`);
  const deliver = {
    checklist: `Here you go: [paste your link]. It takes about ${cl.minutes} minutes. When you're done, send me your score and I'll tell you the first thing I'd fix.`,
    calculator: 'Here you go: [paste your link]. Make a copy, then type your numbers in the Value column. Want me to look at the numbers with you?',
    template: 'Here you go: [paste your link]. Print it or fill it in on your phone. Shout if you get stuck.',
    claim: `It's yours. When works for you this week? ${promiseShort(f.profile.promise)}`,
  }[idea.kind];
  const follow = idea.kind === 'claim'
    ? 'Hey [first name], just checking you saw my last message. Happy to find a time that works.'
    : `Hey [first name], did you get a chance to try the ${idea.kind === 'template' ? idea.title.toLowerCase() : idea.kind}? If you'd like me to handle it${f.price ? `, it's ${money.usd(f.price)}` : ''}. ${promiseShort(f.profile.promise)} Want me to save you a spot?`;
  const story = [
    { frame: 1, text: idea.kind === 'claim' ? idea.title : `Free: ${idea.title.replace(/^The /, '')}` },
    { frame: 2, text: idea.kind === 'checklist' ? `${n} things to check. ${cl.minutes} minutes.` : idea.kind === 'claim' ? text.clip(idea.what, 80) : 'Type your numbers. See the answer.' },
    { frame: 3, text: f.instagram ? `DM me ${kw}` : `${ctaOf(f, kw)}` },
  ];
  return { keyword: kw, post, story, deliver: text.plain(deliver), follow: text.plain(follow) };
}

function shareSteps(kind) {
  if (kind === 'calculator') return ['Open Google Sheets, then File, Import, Upload, and pick the CSV.', 'Click Share, set it to anyone with the link can view.', 'Paste that link where the reply says [paste your link]. People make their own copy.'];
  if (kind === 'claim') return ['Print the page on card stock if you have it, and cut along the dashed lines.', 'Leave them where your buyers already are, with permission.', 'Or post a photo of one card with the caption below.'];
  return ['Open the HTML file and print it, or Save as PDF.', 'Upload the PDF to Google Drive and set sharing to anyone with the link.', 'Paste that link where the reply says [paste your link].'];
}

module.exports = { DATA, buyerWhat, ideas, checklistOf, checklistHtml, calcCsv, calcIdOf, templateHtml, templateIdOf, templateTitle, claimHtml, promo, shareSteps, countItems };
