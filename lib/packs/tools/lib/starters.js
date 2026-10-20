// The ready-made apps. Each one is filled with the member's business name, services, prices and
// contact lines, and renders its first screen as plain HTML (so the preview in HQ shows the real
// layout with scripts off). The script in lib/client/<id>.js makes it work.
//
// starter: { id, title, blurb, words, build(facts, opts) -> { title, lede, note, body, config, script } }

const { text, files } = require('../../_kit');
const { page } = require('./shell');
const { isAddon } = require('./prices');
const MILEAGE = require('../data/mileage.json');

const { esc } = files;
const money = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const addonName = (x) => text.sentenceCase(x.name.replace(/^add[- ]?on:?\s*/i, ''));
const per = (it) => (it.unit ? ` per ${it.unit}` : '');
const exampleNote = (f) => (f.sampleItems ? 'The prices here are examples. Change them in the app settings or build it again with your own price list.' : '');
const field = (label, inner, extra = '') => `<label${extra}>${esc(label)}</label>${inner}`;
const input = (name, attrs = '') => `<input name="${name}" id="f-${name}" ${attrs}>`;
const buttons = (list) => `<div class="row no-print" style="margin-top:12px">${list.map(([id, label, primary]) => `<button class="btn${primary ? ' primary' : ''}" type="button" id="${id}">${esc(label)}</button>`).join('')}</div>`;
const jsNote = '<p class="muted small no-js">This is a preview. Open the file in your browser to use it.</p>';

// ---------- 1. Job price calculator ----------
const jobPrice = {
  id: 'job-price',
  title: 'Job price calculator',
  blurb: 'Price any job in a minute: a base service, extra hours, materials with your markup, travel, add-ons, a minimum charge and tax. Copy the price as a message.',
  words: ['price', 'pricing', 'calculator', 'estimate', 'labor', 'hourly', 'materials', 'markup', 'job cost', 'how much to charge'],
  build(f, o = {}) {
    const base = f.items.filter((x) => !isAddon(x) && !/hour/i.test(x.unit));
    const hourly = f.items.find((x) => /hour/i.test(x.unit));
    const addons = f.items.filter(isAddon);
    const rate = o.rate != null ? o.rate : hourly ? hourly.price : 45;
    const cfg = { validDays: o.validDays || 30 };
    const body = `<form id="calc" class="card" autocomplete="off">
${field('Job name (optional)', input('label', 'placeholder="Smith kitchen, 2 bedrooms..."'))}
${field('Service', `<select name="service" id="f-service"><option value="" data-price="0">No base service, price by the hour</option>${base.map((x, i) => `<option value="${i}" data-price="${x.price}">${esc(x.name)} (${money(x.price)}${per(x)})</option>`).join('')}</select>`)}
<div class="grid2">
${field('Extra hours', input('hours', 'type="number" inputmode="decimal" min="0" step="0.25" value="0"'))}
${field('People on the job', input('crew', 'type="number" inputmode="numeric" min="1" step="1" value="1"'))}
${field('Hourly rate ($)', input('rate', `type="number" inputmode="decimal" min="0" step="1" value="${rate}"`))}
${field('Materials at cost ($)', input('materials', 'type="number" inputmode="decimal" min="0" step="1" value="0"'))}
${field('Markup on materials (%)', input('markup', `type="number" inputmode="decimal" min="0" step="1" value="${o.markup != null ? o.markup : 20}"`))}
${field('Travel fee ($)', input('travel', `type="number" inputmode="decimal" min="0" step="1" value="${o.travel || 0}"`))}
${field('Minimum charge ($)', input('min', `type="number" inputmode="decimal" min="0" step="1" value="${o.min != null ? o.min : 0}"`))}
${field('Sales tax (%)', input('tax', `type="number" inputmode="decimal" min="0" step="0.01" value="${o.tax || 0}"`))}
</div>
${addons.length ? `<label>Add-ons</label>${addons.map((x, i) => `<label class="check"><input type="checkbox" class="addon" value="${i}" data-price="${x.price}" data-name="${esc(addonName(x))}"> ${esc(addonName(x))} <span class="muted">${money(x.price)}</span></label>`).join('')}` : ''}
</form>
<section class="card" aria-live="polite"><div class="muted small">Price for this job</div><div class="total" id="total">${money(0)}</div><div id="lines"></div>
${buttons([['copy', 'Copy as a message', true], ['print', 'Print'], ['reset', 'Start over']])}${jsNote}</section>`;
    return { title: o.title || 'Job price calculator', lede: 'Price a job the same way every time.', note: exampleNote(f), body, config: cfg, script: 'job-price' };
  },
};

// ---------- 2. Quote builder ----------
const quote = {
  id: 'quote',
  title: 'Quote calculator',
  blurb: 'Your price list as a quote builder: tap quantities, add a discount, tax and a deposit, then copy or print the quote. Saved quotes stay on your device.',
  words: ['quote', 'quotes', 'price list', 'estimate', 'invoice', 'line items', 'deposit', 'menu', 'order form'],
  build(f, o = {}) {
    const cfg = { validDays: o.validDays || 30, terms: text.clip(o.terms || '', 200) };
    const body = `<form id="quote" autocomplete="off">
<div class="card"><div class="grid2">${field('Customer', input('customer', 'placeholder="Name"'))}${field('Quote number', input('number', 'inputmode="numeric"'))}</div></div>
<div class="card">${f.items.map((x) => `<div class="qline line" data-name="${esc(x.name)}" data-unit="${esc(x.unit)}" data-price="${x.price}"><span><b style="color:var(--text)">${esc(x.name)}</b><br><span class="small">${money(x.price)}${per(x)}${x.detail ? `, ${esc(x.detail)}` : ''}</span></span><span class="row" style="flex-wrap:nowrap"><button class="btn icon no-print" type="button" data-step="-1" aria-label="Less ${esc(x.name)}">-</button><input name="q-${esc(text.slug(x.name, 30))}" type="number" inputmode="decimal" min="0" step="1" value="0" style="width:70px;text-align:center" aria-label="Quantity of ${esc(x.name)}"><button class="btn icon no-print" type="button" data-step="1" aria-label="More ${esc(x.name)}">+</button></span></div>`).join('')}</div>
<div class="card"><div class="grid2">${field('Discount (%)', input('discount', 'type="number" inputmode="decimal" min="0" max="100" step="1" value="0"'))}${field('Sales tax (%)', input('tax', `type="number" inputmode="decimal" min="0" step="0.01" value="${o.tax || 0}"`))}${field('Deposit to book (%)', input('deposit', `type="number" inputmode="decimal" min="0" max="100" step="1" value="${o.deposit != null ? o.deposit : 0}"`))}</div></div>
</form>
<section class="card" aria-live="polite"><div class="muted small">Quote total</div><div class="total" id="total">${money(0)}</div><div id="lines"></div>
${buttons([['copy', 'Copy as a message', true], ['save', 'Save quote'], ['print', 'Print']])}${jsNote}</section>
<h2 class="no-print">Saved quotes</h2><section class="card no-print" id="saved"><p class="muted small">Quotes you save show here, on this device only.</p></section>`;
    return { title: o.title || 'Quote calculator', lede: `Build a quote from ${f.hasName ? `${f.business}'s` : 'your'} price list.`, note: exampleNote(f), body, config: cfg, script: 'quote' };
  },
};

// ---------- 3. Booking request page ----------
const booking = {
  id: 'booking',
  title: 'Booking request page',
  blurb: 'A page your customers fill in with the service, day and time they want. It writes the request as a text or email they send you from their own phone. No server, no account.',
  words: ['booking', 'book', 'appointment', 'schedule', 'request', 'reservation', 'availability', 'calendar'],
  build(f, o = {}) {
    const svc = f.items.filter((x) => !isAddon(x));
    const cfg = { phone: f.phone, email: f.email };
    const sendBtns = [f.phone ? `<a class="btn primary send" id="sms" href="sms:${esc(f.phone.replace(/[^\d+]/g, ''))}">Send by text</a>` : '', f.email ? `<a class="btn${f.phone ? '' : ' primary'} send" id="mail" href="mailto:${esc(f.email)}">Send by email</a>` : ''].join('');
    const body = `<form id="book" class="card" autocomplete="on">
${field('Your name', input('name', 'autocomplete="name" required'))}
<div class="grid2">${field('Phone', input('phone', 'type="tel" autocomplete="tel"'))}${field('Email (optional)', input('email', 'type="email" autocomplete="email"'))}</div>
${field('Service', `<select name="service" id="f-service"><option value="">Pick one</option>${svc.map((x) => `<option>${esc(x.name)}${x.price ? ` (${money(x.price)}${per(x)})` : ''}</option>`).join('')}<option>Something else (say below)</option></select>`)}
<div class="grid2">${field('Preferred day', input('date', 'type="date"'))}${field('Best time', `<select name="window" id="f-window"><option value="">Any time</option><option>Morning</option><option>Afternoon</option><option>Evening</option></select>`)}</div>
${field('Address or area (optional)', input('address', 'autocomplete="street-address"'))}
${field('Anything we should know (optional)', '<textarea name="notes" id="f-notes" rows="3"></textarea>')}
</form>
<section class="card"><div class="muted small">Your request</div><div class="out" id="preview">Fill in the form to see your request.</div><p class="small" id="problems" style="color:var(--warn)"></p>
<div class="row no-print" style="margin-top:12px">${sendBtns}<button class="btn" type="button" id="copy">Copy</button><button class="btn" type="button" id="clear">Clear</button></div>
<p class="muted small">Nothing is sent until you press send in your own text or email app. ${o.hours ? `Hours: ${esc(o.hours)}.` : ''}</p>${jsNote}</section>`;
    return { title: o.title || `Book with ${f.business}`, lede: o.lede || 'Tell us what you need and when. We reply to confirm a time.', note: exampleNote(f) || (!f.phone && !f.email ? 'Add your phone or email when you build it again, so the send buttons show up.' : ''), body, config: cfg, script: 'booking' };
  },
};

// ---------- 4. Client intake checklist ----------
const DEFAULT_INTAKE = [
  ['Before the first visit', ['Contact details saved', 'What they want, in their words', 'Address and access notes (gate code, parking, pets)', 'Price and what is included agreed', 'Deposit or payment method on file']],
  ['First visit', ['Walk through together', 'Before photos taken', 'Special requests noted', 'Next date booked']],
  ['After', ['Thank-you message sent', 'Invoice or receipt sent', 'Follow-up date set']],
];
const intake = {
  id: 'intake',
  title: 'Client intake checklist',
  blurb: 'One checklist per new client, from first call to follow-up. Tick it off on your phone, add notes, and download every client\'s progress as a CSV.',
  words: ['intake', 'checklist', 'onboarding', 'new client', 'steps', 'process', 'sop', 'to do', 'tick'],
  build(f, o = {}) {
    const sections = (o.sections && o.sections.length ? o.sections : DEFAULT_INTAKE).map(([h, items]) => [h, items.slice(0, 20)]);
    let n = 0;
    const list = sections.map(([h, items]) => `<h2>${esc(h)}</h2>${items.map((it) => `<label class="check"><input type="checkbox" class="item" value="i${++n}" data-label="${esc(it)}"> ${esc(it)}</label>`).join('')}`).join('');
    const body = `<section class="card no-print"><label for="client">Client</label><select id="client"><option value="">Pick a client</option></select>
<div class="row" style="margin-top:10px;flex-wrap:nowrap"><input id="newname" placeholder="New client name" aria-label="New client name"><button class="btn primary" type="button" id="add">Add</button></div></section>
<section class="card"><p id="count" class="muted small">Add a client to start a checklist.</p><div class="bar"><i id="bar"></i></div><div id="list">${list}</div>
<label for="notes">Notes</label><textarea id="notes" rows="3"></textarea>
${buttons([['export', 'Download CSV'], ['print', 'Print'], ['remove', 'Delete client']])}${jsNote}</section>`;
    return { title: o.title || 'New client checklist', lede: 'Every new client, the same steps, nothing missed.', note: '', body, config: {}, script: 'intake' };
  },
};

// ---------- 5. Stock counter ----------
const stock = {
  id: 'stock',
  title: 'Stock counter',
  blurb: 'Count supplies or products with plus and minus buttons, see what\'s running low, copy a reorder list and download the counts.',
  words: ['stock', 'inventory', 'supplies', 'count', 'counter', 'reorder', 'products on hand', 'tracker'],
  build(f, o = {}) {
    const items = (o.items && o.items.length ? o.items : null) || (f.supplies && f.supplies.length ? f.supplies : null) || f.items.filter((x) => !isAddon(x)).map((x) => ({ name: x.name, count: 10, low: 3, unit: '' }));
    const cfg = { items: items.slice(0, 200).map((x) => ({ name: text.clip(x.name, 60), count: Math.max(0, Math.round(Number(x.count) || 0)), low: Math.max(0, Math.round(Number(x.low) || 0)), unit: text.clip(x.unit || '', 20) })) };
    const rows = cfg.items.map((x) => `<tr><td><b>${esc(x.name)}</b></td><td>${x.count}</td><td>${x.low}</td></tr>`).join('');
    const body = `<section class="card"><div class="row" style="justify-content:space-between"><b id="lowcount">Counts</b><span class="muted small" id="counted"></span></div>
<div class="scroll"><table><thead><tr><th>Item</th><th>Count</th><th>Low at</th></tr></thead><tbody id="rows">${rows}</tbody></table></div>
${buttons([['reorder', 'Copy reorder list', true], ['export', 'Download CSV'], ['reset', 'Reset counts']])}${jsNote}</section>
<form id="addform" class="card no-print" autocomplete="off"><b>Add an item</b><div class="grid2">${field('Item', '<input id="newitem">')}${field('Count now', '<input id="newcount" type="number" inputmode="numeric" min="0">')}${field('Low at', '<input id="newlow" type="number" inputmode="numeric" min="0" value="2">')}</div><div class="row" style="margin-top:12px"><button class="btn primary" type="submit">Add item</button></div></form>`;
    return { title: o.title || 'Stock counter', lede: 'Tap as things come in and go out.', note: f.supplies ? '' : 'The starting items come from your services. Rename them to the supplies you count, or add your own below.', body, config: cfg, script: 'stock' };
  },
};

// ---------- 6. Tip splitter ----------
const tips = {
  id: 'tips',
  title: 'Tip splitter',
  blurb: 'Split a tip pool by hours worked, by points or evenly. Every cent is given out, and you can copy the split for the team chat.',
  words: ['tip', 'tips', 'split', 'splitter', 'pool', 'gratuity', 'staff', 'team', 'hours worked'],
  build(f, o = {}) {
    const staff = (o.staff && o.staff.length ? o.staff : ['Alex', 'Maria', 'Sam']).slice(0, 40).map((s) => text.clip(s, 40));
    const body = `<form id="calc" class="card" autocomplete="off">
<div class="grid2">${field('Tips to split ($)', '<input id="total" type="number" inputmode="decimal" min="0" step="0.01" value="0">')}${field('Split by', `<select id="mode"><option value="hours"${o.mode === 'hours' || !o.mode ? ' selected' : ''}>Hours worked</option><option value="points"${o.mode === 'points' ? ' selected' : ''}>Points</option><option value="even"${o.mode === 'even' ? ' selected' : ''}>Evenly</option></select>`)}${field('Round to', '<select id="step"><option value="0.01">Cents</option><option value="1">Whole dollars</option></select>')}</div>
<div class="row" style="justify-content:space-between;margin-top:14px"><b>Team</b><span class="muted small" id="wlabel">Hours</span></div><div id="people">${staff.map((s) => `<div class="row" style="flex-wrap:nowrap;margin:8px 0"><input value="${esc(s)}" aria-label="Name"><input style="width:96px" placeholder="Hours" aria-label="Hours"></div>`).join('')}</div>
<div class="row no-print"><button class="btn" type="button" id="addp">Add a person</button></div></form>
<section class="card" aria-live="polite"><div class="muted small">Each person gets</div><div id="result"></div>${buttons([['copy', 'Copy the split', true]])}${jsNote}</section>`;
    return { title: o.title || 'Tip splitter', lede: 'A fair split in seconds, every cent accounted for.', note: '', body, config: { staff }, script: 'tips' };
  },
};

// ---------- 7. Client portal page ----------
const DEFAULT_STEPS = ['Booked', 'Prep and planning', 'The work', 'Final walk-through', 'Done'];
const linkOk = (u) => /^(https:\/\/|mailto:|tel:|sms:)[^\s"'<>]+$/i.test(String(u || '').trim());
const portal = {
  id: 'portal',
  title: 'Client portal page',
  blurb: 'One page per client with where their job stands, the next visit, links to book or pay, answers to common questions and their own to-do list.',
  words: ['portal', 'client page', 'client portal', 'status', 'project', 'progress', 'customer page', 'welcome'],
  build(f, o = {}) {
    const client = text.clip(o.client || 'Your client', 60);
    const steps = (o.steps && o.steps.length ? o.steps : DEFAULT_STEPS).slice(0, 10).map((s) => text.clip(s, 60));
    const now = Math.max(0, Math.min(steps.length - 1, Number(o.stage) || 1));
    const links = [
      ...(o.links || []),
      f.booking ? { label: 'Book your next visit', href: f.booking } : null,
      o.payLink ? { label: 'Pay your invoice', href: o.payLink } : null,
    ].filter((l) => l && linkOk(l.href)).slice(0, 8);
    const contact = [f.phone ? `<a class="btn" href="tel:${esc(f.phone.replace(/[^\d+]/g, ''))}">Call</a><a class="btn" href="sms:${esc(f.phone.replace(/[^\d+]/g, ''))}">Text</a>` : '', f.email ? `<a class="btn" href="mailto:${esc(f.email)}">Email</a>` : ''].join('');
    const todos = (o.todos && o.todos.length ? o.todos : ['Clear the work area', 'Secure pets', 'Share the gate or door code']).slice(0, 12);
    const faq = (o.faq && o.faq.length ? o.faq : [['What if I need to change the date?', 'Message us at least a day before and we will find a new time.'], ['How do I pay?', 'You get an invoice when the job is done. Pay by the link on this page or the way we agreed.']]).slice(0, 10);
    const body = `<section class="card"><div class="muted small">Where things stand</div>
<ol style="list-style:none;padding:0;margin:8px 0">${steps.map((s, i) => `<li class="line"><span>${esc(s)}</span><span class="pill${i < now ? ' done' : ''}">${i < now ? 'Done' : i === now ? 'Now' : 'Next'}</span></li>`).join('')}</ol></section>
${o.next ? `<section class="card"><div class="muted small">Next visit</div><div class="total" style="font-size:24px">${esc(text.clip(o.next, 80))}</div></section>` : ''}
${links.length ? `<section class="card"><div class="muted small">Links</div><div class="row" style="margin-top:8px">${links.map((l) => `<a class="btn primary" href="${esc(l.href)}" rel="noopener noreferrer">${esc(text.clip(l.label, 40))}</a>`).join('')}</div></section>` : ''}
<section class="card"><div class="row" style="justify-content:space-between"><b>Your to-dos</b><span class="muted small" id="todocount"></span></div>${todos.map((t, i) => `<label class="check"><input type="checkbox" class="todo" value="t${i + 1}"> ${esc(text.clip(t, 120))}</label>`).join('')}<p class="muted small">Your ticks are saved on your device only.</p></section>
<section class="card"><b>Questions</b>${faq.map(([q, a]) => `<details style="margin:10px 0"><summary style="cursor:pointer">${esc(text.clip(q, 120))}</summary><p class="muted">${esc(text.clip(a, 400))}</p></details>`).join('')}</section>
${contact ? `<section class="card no-print"><b>Reach us</b><div class="row" style="margin-top:8px">${contact}</div></section>` : ''}
<div class="row no-print"><button class="btn" type="button" id="print">Print this page</button></div>`;
    return { title: o.title || `${client}: your project`, lede: o.lede || `Everything about your ${f.what ? text.clip(f.what, 40).toLowerCase() : 'job'} with ${f.business} in one place.`, note: '', body, config: {}, script: 'portal' };
  },
};

// ---------- 8. Mileage log ----------
const mileage = {
  id: 'mileage',
  title: 'Mileage log',
  blurb: 'Log business trips by miles or odometer, see totals by month at the IRS standard mileage rate for each trip\'s date, and download a CSV for your records.',
  words: ['mileage', 'miles', 'mile', 'trip', 'trips', 'driving', 'odometer', 'car log', 'deduction', 'log'],
  build(f, o = {}) {
    const purposes = (o.purposes && o.purposes.length ? o.purposes : ['Client visit', 'Supplies run', 'Bank or post office', 'Estimate']).slice(0, 12);
    const body = `<section class="card"><div class="grid2"><div><div class="muted small">Miles this year</div><div class="total" id="ymiles">0 mi</div></div><div><div class="muted small">At the standard rate</div><div class="total" id="yamount">$0</div></div></div>
<p class="muted small">Uses the IRS business rate for each trip's date (${MILEAGE.rates.map((r) => `${Math.round(r.rate * 1000) / 10} cents from ${r.from}`).join(', ')}). Rates change: check irs.gov before you file.</p></section>
<form id="trip" class="card no-print" autocomplete="off"><b>Add a trip</b>
<div class="grid2">${field('Date', input('date', 'type="date"'))}${field('Business reason', `${input('purpose', 'list="purposes" placeholder="Client visit"')}<datalist id="purposes">${purposes.map((p) => `<option value="${esc(p)}">`).join('')}</datalist>`)}${field('From', input('from', `placeholder="${esc(f.city || 'Home')}"`))}${field('To', input('to', 'placeholder="Where you went"'))}${field('Miles', input('miles', 'type="number" inputmode="decimal" min="0" step="0.1"'))}${field('Or odometer start', input('start', 'type="number" inputmode="decimal" min="0"'))}${field('Odometer end', input('end', 'type="number" inputmode="decimal" min="0"'))}</div>
<label class="check"><input type="checkbox" name="round"> Round trip (doubles the miles)</label>
<div class="row" style="margin-top:12px"><button class="btn primary" type="submit">Save trip</button><button class="btn" type="button" id="export">Download CSV</button></div></form>
<h2>By month</h2><section class="card scroll"><table><thead><tr><th>Month</th><th>Trips</th><th>Miles</th><th>At rate</th></tr></thead><tbody id="months"><tr><td colspan="4" class="muted">No trips yet this year.</td></tr></tbody></table></section>
<h2>Recent trips</h2><section class="card scroll"><table><thead><tr><th>Date</th><th>Trip</th><th>Miles</th><th></th></tr></thead><tbody id="trips"></tbody></table>${jsNote}</section>`;
    return { title: o.title || 'Mileage log', lede: 'Log each business trip the day you drive it.', note: '', body, config: { rates: MILEAGE.rates }, script: 'mileage' };
  },
};

// ---------- 9. Simple form ----------
const DEFAULT_FIELDS = [
  { id: 'name', label: 'Name', type: 'text', required: true },
  { id: 'phone', label: 'Phone', type: 'tel' },
  { id: 'email', label: 'Email', type: 'email' },
  { id: 'service', label: 'What do you need?', type: 'textarea' },
  { id: 'heard', label: 'How did you hear about us?', type: 'select', options: ['Friend or neighbor', 'Instagram', 'Google', 'Flyer', 'Other'] },
];
function fieldHtml(x) {
  const req = x.required ? ' required' : '';
  const lab = `${x.label}${x.required ? ' *' : ''}`;
  if (x.type === 'textarea') return field(lab, `<textarea name="${x.id}" id="f-${x.id}" rows="3"${req}></textarea>`, ` for="f-${x.id}"`);
  if (x.type === 'select') return field(lab, `<select name="${x.id}" id="f-${x.id}"${req}><option value="">Pick one</option>${(x.options || []).map((op) => `<option>${esc(op)}</option>`).join('')}</select>`, ` for="f-${x.id}"`);
  if (x.type === 'checkbox') return `<label class="check"><input type="checkbox" name="${x.id}"> ${esc(lab)}</label>`;
  const t = ['text', 'email', 'tel', 'number', 'date', 'time'].includes(x.type) ? x.type : 'text';
  return field(lab, `<input name="${x.id}" id="f-${x.id}" type="${t}"${t === 'number' ? ' inputmode="decimal"' : ''}${req}>`, ` for="f-${x.id}"`);
}
const form = {
  id: 'form',
  title: 'Simple form',
  blurb: 'A form for intake, sign-ups, orders or feedback. Answers are saved on the device you fill it in on: copy them into a spreadsheet or download a CSV. Nothing is sent anywhere.',
  words: ['form', 'survey', 'sign up', 'signup', 'questionnaire', 'feedback', 'collect', 'answers', 'register', 'waiver'],
  build(f, o = {}) {
    const fields = (o.fields && o.fields.length ? o.fields : DEFAULT_FIELDS).slice(0, 40);
    const body = `<form id="form" class="card" autocomplete="on" novalidate>${fields.map(fieldHtml).join('\n')}
<p class="small" id="problems" style="color:var(--warn)"></p><div class="row" style="margin-top:12px"><button class="btn primary" type="submit">Save answer</button></div></form>
<section class="card no-print"><div class="row" style="justify-content:space-between"><b id="n">No answers saved yet</b></div>
<div class="row" style="margin-top:10px"><button class="btn" type="button" id="copy">Copy for a spreadsheet</button><button class="btn" type="button" id="csv">Download CSV</button><button class="btn" type="button" id="clear">Delete all</button></div>
<div class="scroll" style="margin-top:12px"><table><thead id="head"></thead><tbody id="rows"></tbody></table></div>
<p class="muted small">Answers are saved in this browser on this device only, and nothing is sent anywhere. Download the CSV often so you have a copy.</p>${jsNote}</section>`;
    return { title: o.title || 'New client form', lede: o.lede || `Questions from ${f.business}.`, note: '', body, config: { fields, thanks: text.clip(o.thanks || 'Thanks. Your answer is saved.', 120) }, script: 'form' };
  },
};

// ---------- 10. Searchable lookup (from a spreadsheet) ----------
const lookup = {
  id: 'lookup',
  title: 'Search lookup',
  blurb: 'Any spreadsheet as a fast search app: type a few letters to find a part, a price, a client or a code. Works with no connection.',
  words: ['lookup', 'look up', 'search', 'find', 'directory', 'catalog', 'spreadsheet', 'csv', 'list', 'database', 'parts', 'price lookup'],
  build(f, o = {}) {
    const columns = (o.columns && o.columns.length ? o.columns : ['Service', 'Price', 'Unit', 'Details']).slice(0, 20);
    const rows = o.rows && o.rows.length ? o.rows : f.items.map((x) => [x.name, money(x.price), x.unit, x.detail]);
    const first = rows.slice(0, 50);
    const body = `<form id="search" class="card" role="search" autocomplete="off"><div class="grid2">${field('Search', '<input id="q" type="search" placeholder="Type to search" autofocus>')}${field('In', `<select id="col"><option value="-1">Every column</option>${columns.map((c, i) => `<option value="${i}">${esc(c)}</option>`).join('')}</select>`)}</div><p class="muted small" id="count">${rows.length} rows</p></form>
<section class="card scroll"><table><thead><tr>${columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody id="body">${first.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>
<div class="row no-print" style="margin-top:12px"><button class="btn" type="button" id="more" style="display:none">Show more</button></div><p class="muted small">Tap a row to copy it.</p>${jsNote}</section>`;
    return { title: o.title || 'Price lookup', lede: o.lede || `${rows.length} rows${o.source ? ` from ${o.source}` : ''}.`, note: o.rows ? '' : exampleNote(f), body, config: { columns, rows }, script: 'lookup' };
  },
};

const STARTERS = [jobPrice, quote, booking, intake, stock, tips, portal, mileage, form, lookup];
const byId = (id) => STARTERS.find((s) => s.id === id) || null;
// The gallery: every starter that needs nothing more than the member's facts.
const GALLERY = STARTERS.filter((s) => s.id !== 'lookup');

// Builds one starter into a full HTML file. Returns { html, title, starter, note }.
function render(id, facts, opts = {}) {
  const s = byId(id) || jobPrice;
  const r = s.build(facts, opts);
  const key = `${text.slug(facts.business, 30) || 'app'}-${s.id}`;
  // What the app was built from, so "change my app" can rebuild it without AI.
  const source = { what: facts.what, city: facts.city, phone: facts.phone, email: facts.email, booking: facts.booking, accent: facts.accent && facts.accent.accent, items: facts.items, sampleItems: !!facts.sampleItems, opts: s.id === 'lookup' ? { ...opts, rows: undefined, columns: undefined } : opts };
  const config = { ...r.config, key, business: facts.business, currency: 'USD', starter: s.id, version: 1, source };
  const html = page({ title: r.title, business: facts.business, lede: r.lede, body: r.body, config, script: r.script, accent: facts.accent, note: r.note });
  return { html, title: r.title, starter: s.id, note: r.note || '' };
}

// The closest starter to a description: keyword hits weighted by length, ties to the gallery order.
function nearest(description) {
  const d = ` ${String(description || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ')} `;
  let best = { id: 'job-price', score: 0 };
  for (const s of STARTERS) {
    let score = 0;
    for (const w of s.words) if (d.includes(` ${w} `) || (w.length > 4 && d.includes(w))) score += w.split(' ').length + (w.length > 6 ? 1 : 0);
    if (score > best.score) best = { id: s.id, score };
  }
  return best.id;
}

module.exports = { STARTERS, GALLERY, byId, render, nearest, DEFAULT_FIELDS, DEFAULT_INTAKE, linkOk, money };
