// Your first 25 and your next 25: real plumbing, HVAC, roofing and electrical businesses near the
// member, each with what a caller can't find on its own website (booking, chat, form, tap-to-call,
// hours), ranked for a front desk setup, with first messages for every one (AI first lines for the
// top 5) and a CSV. Facts come from each business's own website; Google listing facts (name, phone,
// rating) never leave the run. With save on, every business lands in the member's Pipeline with what
// Do my day reads (msg, facts, score, channel; contract 13). With skipKnown on, anyone already in the
// Pipeline is left out. OpenStreetMap lists carry the ODbL credit on screen and in the CSV (D27).

const kit = require('../../_kit');
const { text, time, views, files, save, brain, web } = kit;
const NICHE = require('../data/niche.json');

const TRADES = Object.keys(NICHE.trades);
const SUBTRADES = TRADES.filter((t) => t !== 'contractors');
const CHANNEL = { ig: 'ig', email: 'email', fb: 'fb', form: 'site', call: 'call' };

function splitList(s) {
  return String(s || '')
    .split(/[\n,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

// n business days after a date (weekends skipped).
function bizDays(date, n) {
  let d = date;
  let left = n;
  const dow = (x) => new Date(`${x}T12:00:00Z`).getUTCDay();
  while (dow(d) === 0 || dow(d) === 6) d = time.addDays(d, 1);
  while (left > 0) {
    d = time.addDays(d, 1);
    if (dow(d) !== 0 && dow(d) !== 6) left--;
  }
  return d;
}

// A first 25 goes out over a week (5, 5, 5, then 10); a refill goes out 25 a business day, the way
// Do my day hands it out.
function sendDay(rank, daily) {
  if (daily) return Math.floor((rank - 1) / 25);
  if (rank <= 5) return 0;
  if (rank <= 10) return 1;
  if (rank <= 15) return 3;
  return 5;
}

const lower = (s) => String(s || '').toLowerCase().trim();

// Enough businesses for the batch: wider circles (15, 30, 50 km) for big batches, and in sample runs
// each trade's own made-up list. Pipeline and typed skips dropped here.
async function gather(ctx, { trade, city, want, known, excl }) {
  const T = NICHE.trades[trade];
  const base = kit.places.categoryOf(T.category);
  const big = want > 40;
  const seen = new Set();
  const kept = [];
  const dropped = { closed: 0, chains: 0, dupes: 0, known: 0 };
  let first = null;
  let searches = 0;
  const take = (found, cat) => {
    const f = kit.places.filterPlaces(found.places || [], { category: cat, known: [...known.keys, ...known.sites] });
    for (const k of Object.keys(dropped)) dropped[k] += (f.dropped && f.dropped[k]) || 0;
    for (const p of f.kept) {
      const dom = p.website ? web.domainOf(p.website) : '';
      const ids = [`k:${p.key}`, `n:${lower(p.name)}`, dom ? `w:${dom}` : ''].filter(Boolean);
      if (ids.some((x) => seen.has(x))) continue;
      ids.forEach((x) => seen.add(x));
      if (excl.has(lower(p.placeId)) || excl.has(lower(p.name)) || known.names.has(lower(p.name))) {
        dropped.known++;
        continue;
      }
      kept.push({ ...p, _cat: cat });
    }
  };
  for (const r of big ? [15, 30, 50] : [15]) {
    const found = await kit.places.findPlaces(ctx, { category: base, city, limit: Math.min(60, want + 15), radiusKm: r });
    searches++;
    if (!first) first = found;
    take(found, base);
    if (found.sample || kept.length >= want + 10) break;
  }
  // Sample lists don't grow with distance: a big sample batch for all four trades uses each trade's own list.
  if (first && first.sample && trade === 'contractors' && kept.length < want + 5) {
    for (const t of SUBTRADES) {
      const cat = kit.places.categoryOf(NICHE.trades[t].category);
      take(await kit.places.findPlaces(ctx, { category: cat, city, limit: Math.min(60, want + 15) }), cat);
      searches++;
      if (kept.length >= want + 10) break;
    }
  }
  return { found: first || { places: [], source: 'sample', sample: true }, kept, dropped, searches };
}

// Every lead in the Pipeline with its messages; email-first leads get the email follow-ups (D28).
async function toPipeline(ctx, list, drafts, { service, trade }) {
  if (!ctx || !ctx.leads || typeof ctx.leads.upsert !== 'function') return { saved: 0, error: '', first: null };
  let saved = 0;
  let error = '';
  let first = null;
  for (let i = 0; i < list.length; i++) {
    const lead = list[i];
    const row = kit.leads.pipelineLead(lead, { service, draft: drafts[i] });
    row.data = { ...(row.data || {}), trade, placeSource: lead.source || '', ...(lead.searchBy ? { searchBy: lead.searchBy } : {}) };
    try {
      const back = await ctx.leads.upsert(row);
      if (i === 0) first = { ...row, id: (back && back.id) || null };
      saved++;
    } catch (e) {
      error = web.scrubKeys(text.oneLine(String((e && e.message) || ''))).slice(0, 160);
      if (/full/i.test(error)) break;
    }
  }
  return { saved, error, first };
}

module.exports = {
  name: 'frontdesk.find_25',
  title: 'Find 25 contractors',
  description: 'Lists real home service contractors near you (25 by default, up to 100), reads each website for what a caller can\'t find (online booking, chat, a form, tap-to-call, hours), ranks them, drafts messages for every one and can add them to your Pipeline, skipping anyone already there.',
  kind: 'api',
  risk: 'draft',
  needs: [],
  wants: ['places', 'osm'],
  tasks: ['write'],
  credits: 30,
  input: {
    type: 'object',
    required: ['city'],
    properties: {
      city: { type: 'string', maxLength: 120 },
      trade: { type: 'string', enum: TRADES },
      myName: { type: 'string', maxLength: 60 },
      myBusiness: { type: 'string', maxLength: 80 },
      myAddress: { type: 'string', maxLength: 160 },
      exclude: { type: 'string', maxLength: 6000 },
      batch: { type: 'integer', minimum: 1, maximum: 8 },
      count: { type: 'integer', minimum: 10, maximum: 100, title: 'How many', description: '25 by default.' },
      skipKnown: { type: 'boolean', title: 'Skip everyone already in my Pipeline' },
      save: { type: 'boolean', title: 'Add them to my Pipeline' },
    },
  },
  output: { type: 'object', required: ['leads', 'messages'], properties: { leads: { type: 'array' }, messages: { type: 'array' }, top: { type: 'object' }, saved: { type: 'integer' } } },
  timeoutSec: 420,
  async run(input, ctx) {
    const br = brain.brainOf(ctx, input);
    const trade = TRADES.includes(input.trade) ? input.trade : 'contractors';
    const T = NICHE.trades[trade];
    const city = text.plain(input.city || br.place || br.city || '');
    const batch = Math.max(1, Math.min(8, Number(input.batch) || 1));
    const per = Math.max(10, Math.min(100, Number(input.count) || 25));
    const daily = !!input.save && !!input.skipKnown;
    const service = NICHE.service;
    const sender = { first: text.plain(input.myName || br.firstName || ''), business: text.plain(input.myBusiness || br.name || ''), city, address: text.plain(input.myAddress || '') };
    const now = ctx && ctx.now ? ctx.now() : Date.now();
    const today = time.today(ctx);

    const known = input.skipKnown ? await kit.leads.known(ctx) : { keys: new Set(), names: new Set(), sites: new Set() };
    const typed = splitList(input.exclude).map(lower);
    for (const x of typed) {
      const d = x.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '');
      if (/\./.test(d) && !/\s/.test(d)) known.sites.add(d);
      else known.keys.add(x);
    }
    const want = per * batch;
    const { found, kept, dropped, searches } = await gather(ctx, { trade, city, want, known, excl: new Set(typed) });
    ctx.log(`Found ${kept.length} businesses to check${dropped.known ? `, skipped ${dropped.known} already in your Pipeline or your list` : ''}`);

    const scans = await web.mapLimit(kept, 6, (p) => (p.website ? kit.leads.scanFor(ctx, p.website) : null), ctx);
    const all = kept.map((p, i) => {
      const lead = kit.leads.makeLead(p, scans[i], { now, category: p._cat, city });
      return p.searchBy ? { ...lead, searchBy: p.searchBy } : lead;
    });
    const ranked = kit.leads.rankLeads(all, service, { top: want });
    const list = ranked.leads.slice(per * (batch - 1)).map((l, i) => ({ ...l, rank: i + 1 }));

    const drafts = list.map((lead) => kit.outreach.draft({ lead, service, sender, cityName: city.split(',')[0] }));
    const better = await kit.outreach.aiOpeners(ctx, list.slice(0, 5).map((lead, i) => ({ lead, draft: drafts[i] })), { service, sender });
    for (let i = 0; i < Math.min(5, list.length); i++) drafts[i] = better.drafts[i] || drafts[i];

    // Where each first message goes, and the follow-ups in that form (email ones end like the email).
    const best = list.map((lead) => kit.outreach.channels(lead, service).map((c) => CHANNEL[c.id]).find(Boolean) || '');
    const byEmail = (i) => best[i] === 'email' || best[i] === 'site';
    const sendOn = (rank) => bizDays(today, sendDay(rank, daily));
    const rows = list.map((lead, i) => {
      const d = drafts[i];
      const msg = byEmail(i) ? { ...d, followUp1: d.followUp1Email, followUp2: d.followUp2Email } : d;
      return kit.leads.csvRow(lead, msg, { sendOn: sendOn(lead.rank) });
    });
    const credit = kit.places.creditLine(list);
    const csvText = files.csv(credit ? rows.concat([{ rank: credit }]) : rows, kit.leads.CSV_COLUMNS, { bom: true });
    const label = daily ? `next-${list.length}` : batch > 1 ? `batch-${batch}` : 'first-25';
    const csvAsset = list.length ? await save.saveFile(ctx, save.fileName(sender.business || 'front-desk', city.split(',')[0] || 'leads', label, daily ? today : '', '.csv'), csvText) : null;

    const pipe = input.save ? await toPipeline(ctx, list, drafts, { service, trade }) : { saved: 0, error: '', first: null };
    if (pipe.saved) ctx.log(`Added ${pipe.saved} businesses to your Pipeline with their messages`);

    const google = found.source === 'google';
    const slim = (lead, i) => ({
      rank: lead.rank,
      key: lead.key,
      name: kit.leads.exportName(lead) || (google ? 'Open the map link' : lead.name),
      score: lead.score,
      missing: kit.leads.shareableGaps(lead).filter((g) => (service.gaps[g.id] || 0) > 0).map((g) => g.chip).slice(0, 4),
      website: lead.site ? lead.site.url : lead.siteStatus === 'none' ? '' : lead.website || '',
      phone: (lead.site && lead.site.contacts.phones[0]) || (!google && lead.phone) || '',
      email: (lead.site && lead.site.contacts.emails[0]) || '',
      mapsUrl: lead.mapsUrl || '',
      placeId: lead.placeId || '',
      siteStatus: lead.siteStatus,
      channel: best[i],
      sendOn: sendOn(lead.rank),
      source: lead.source,
      ...(lead.searchBy ? { searchBy: lead.searchBy } : {}),
    });
    const leadsOut = list.map(slim);
    const messages = list.slice(0, 5).map((lead, i) => {
      const d = drafts[i];
      return {
        rank: lead.rank,
        name: leadsOut[i].name,
        why: kit.leads.shareableGaps(lead).filter((g) => (service.gaps[g.id] || 0) > 0).map((g) => g.chip).slice(0, 3).join(', '),
        channels: kit.outreach.channels(lead, service).slice(0, 3).map((c) => `${c.label}: ${c.to}`),
        channel: best[i],
        email: d.email,
        dm: d.dm,
        call: d.call,
        voicemail: d.voicemail,
        walkIn: d.walkIn,
        followUp1: byEmail(i) ? d.followUp1Email : d.followUp1,
        followUp2: byEmail(i) ? d.followUp2Email : d.followUp2,
        ai: !!d.ai,
      };
    });
    const first = list[0];
    const top = first
      ? {
          rank: 1,
          key: first.key,
          name: leadsOut[0].name,
          website: leadsOut[0].website,
          siteStatus: first.siteStatus,
          mapsUrl: first.mapsUrl || '',
          placeId: first.placeId || '',
          trade,
          city,
          source: first.source || found.source,
          ...(first.searchBy ? { searchBy: first.searchBy } : {}),
          // Saved to the Pipeline: the plan step puts its email on this lead, so Do my day sends that one.
          ...(pipe.first ? { inPipeline: true, stage: 'found', touches: 0, id: pipe.first.id, channel: pipe.first.channel || best[0], facts: pipe.first.facts || [], data: pipe.first.data || {} } : {}),
        }
      : null;
    const hl = kit.leads.headline(ranked.stats, service);
    const head = hl.map((h) => h.line);
    // One sentence, one denominator: "Of the 31 websites we checked: 26 have no chat, 9 ...".
    const siteLines = hl.filter((h) => h.id !== 'no_site').map((h) => h.line.replace(/^(\d+) of \d+ /, '$1 '));
    const noSite = hl.find((h) => h.id === 'no_site');
    const headNote = [siteLines.length ? `Of the ${ranked.stats.checked} websites we checked, ${text.list(siteLines)}` : '', noSite ? noSite.line : ''].filter(Boolean).join('. ');
    const placeholder = /\[[^\]\n]{2,60}\]/.test(first ? drafts[0].email.body : '');
    return {
      city,
      trade,
      tradeLabel: T.label,
      source: found.source,
      attribution: found.attribution,
      sample: !!found.sample,
      note: text.plain(web.scrubKeys(found.note || '')),
      dropped,
      searches,
      headline: head,
      headNote,
      found: ranked.stats.found,
      checked: ranked.stats.checked,
      leads: leadsOut,
      messages,
      replies: first ? kit.outreach.replies({ lead: first, service, sender }) : [],
      rules: kit.outreach.RULES,
      daily,
      plan: daily
        ? [
            `Do my day hands these out ${Math.min(25, list.length)} a day, best fit first, with each message written. Open it each morning.`,
            'Before you send, open each website and check the line about them is still true.',
            'Answer replies first: paste what they wrote into "Answer a reply".',
            'Want a free sample for one of them? Run "Make a free sample" on its name.',
          ]
        : [
            'Today: make the missed-call plan for #1 (next step) and send messages to #1 to #5.',
            'Tomorrow: send #6 to #10. Walk into the 2 closest shops with the walk-in line.',
            'Day 3: follow up with #1 to #5, with the plan picture attached. Send #11 to #15.',
            'Day 5: send #16 to #25. Day 7: last follow-ups, then mark every reply in your Pipeline.',
          ],
      hasTop: !!top,
      top,
      csv: csvAsset,
      saved: pipe.saved,
      saveError: pipe.error,
      skippedKnown: dropped.known,
      short: list.length < per,
      wanted: per,
      needsAddress: placeholder && !sender.address,
      aiOpeners: !!better.ai,
      checkedOn: today,
    };
  },
  view(out) {
    const cols = [
      { key: 'rank', label: '#', format: 'number' },
      { key: 'name', label: 'Business' },
      { key: 'score', label: 'Fit', format: 'number' },
      { key: 'missing', label: 'What callers can\'t find' },
      { key: 'website', label: 'Website', format: 'link' },
      { key: 'sendOn', label: 'Send on' },
    ];
    const rows = out.leads.map((l) => ({ ...l, missing: l.missing.join(', ') || 'Nothing major: lower priority' }));
    const m = out.messages[0];
    // The follow-up templates shown in a first run: #2's (#1's come with the plan).
    const f = out.messages[1] || null;
    const fEmail = f && (f.channel === 'email' || f.channel === 'site');
    return views.blocks(
      out.sample ? views.text(out.note || 'These are made-up sample businesses, so you can see how it works.') : null,
      views.metric(`${out.tradeLabel} near ${out.city}`, out.leads.length, out.headNote || out.headline.join('. ')),
      out.saved ? views.metric('Added to your Pipeline', out.saved, 'Each with its first message, two follow-ups and the facts it cites. Do my day hands them out.') : null,
      out.saveError ? views.text(`Some weren't added to your Pipeline: ${out.saveError}`) : null,
      out.skippedKnown ? views.text(`Skipped ${out.skippedKnown} already in your Pipeline or your skip list.`) : null,
      out.short ? views.text(`Only ${out.leads.length} new businesses turned up near ${out.city}${out.wanted ? ` (you asked for ${out.wanted})` : ''}. Try a nearby town or another trade for more.`) : null,
      out.needsAddress ? views.text('Add your mailing address in the form: US law asks for it in business email, and the emails keep a blank for it until you do.') : null,
      views.table(cols, rows),
      out.source === 'google' ? views.text('Business data: Google Maps. Names and phones from Google stay in this run; the CSV keeps the place ID and the map link.') : null,
      kit.places.creditBlocks(out.leads),
      // Daily runs: #1 here, the rest in the Pipeline for Do my day. A first run: #1 gets the
      // missed-call plan and its own messages in the next steps, so this shows #2 to #5.
      out.daily && m ? views.copy(`Email to #1 (${m.name})`, `Subject: ${m.email.subject}\n\n${m.email.body}`) : null,
      out.daily && m ? views.copy('Call opener for #1', m.call) : null,
      !out.daily && m ? views.text(`#1 (${m.name}) gets the missed-call plan: its email and message come with the plan below.`) : null,
      ...(out.daily ? [] : out.messages.slice(1).map((x) => views.copy(`Email to #${x.rank} (${x.name})`, `Subject: ${x.email.subject}\n\n${x.email.body}`))),
      f && !out.daily ? views.copy(`Call opener for #${f.rank}`, f.call) : null,
      f && !out.daily ? views.copy(fEmail ? 'Follow-up email, day 3' : 'Follow-up, day 3', f.followUp1) : null,
      f && !out.daily ? views.copy(fEmail ? 'Follow-up email, day 7' : 'Follow-up, day 7', f.followUp2) : null,
      views.cards(out.plan.map((p, i) => ({ title: `Step ${i + 1}`, body: p }))),
      views.file(out.csv, `All ${out.leads.length} with messages and send dates (CSV)`),
      views.text(out.rules.join(' ')),
    );
  },
};
