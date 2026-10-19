// The message for each store: the member writes as themselves, cites only what the audit read on
// the store's public pages, offers one flat price per job and promises only what they control (on
// time, a redo, a refund of their own fee). Code templates, varied per store, so 25 messages cost
// next to nothing; the member edits before sending from their own email or Instagram. With
// `pipeline`, each store is saved to the Pipeline with its messages, so Do my day hands them out.

const { text, money, files, save, views, brain, time, places, outreach } = require('../../_kit');

function normalize(s) {
  if (!s) return null;
  if (s.numbers && s.store) {
    // A raw audit output (the spec fix workflow).
    return {
      name: s.store.name,
      url: s.store.url,
      domain: s.store.domain,
      score: s.score,
      fixes: (s.fixes || []).slice(0, 3).map((f) => ({ id: f.id, title: f.title, evidence: f.evidence, minutes: f.minutes })),
      email: (s.pitch && s.pitch.store && s.pitch.store.emails && s.pitch.store.emails[0]) || null,
      instagram: (s.pitch && s.pitch.store && s.pitch.store.instagram) || null,
      report: s.report || null,
      target: s.pitch && s.pitch.target ? s.pitch.target.title : null,
      sample: !!s.sample,
      ok: s.ok,
    };
  }
  return { ...s, target: s.pitch && s.pitch.target ? s.pitch.target.title : null, ok: true };
}

// Audit lines say "we"; in the member's own message they say "I".
const mine = (t) => String(t || '').replace(/\bWe\b/g, 'I').replace(/\bwe\b/g, 'I');
const poss = (n) => (/s$/i.test(String(n || '')) ? `${n}'` : `${n}'s`);
// "I" stays a capital: "noticed this: I didn't see a reviews app".
const lower = (t) => String(t || '').replace(/^(?!I\b)./, (c) => c.toLowerCase()).replace(/\.$/, '');
// A fact line in Do my day is about the store, not the audit's "we": "Didn't see a reviews app on the homepage."
const factOf = (t) => String(t || '').replace(/^We didn't see /, "Didn't see ").replace(/\bwe checked\b/g, 'checked').replace(/\bWe\b/g, 'The audit').replace(/\bwe\b/g, 'the audit');

// "I'm Sam, a Shopify designer in Asheville." The Pipeline's copy leaves out a [your name] placeholder
// (HQ signs the email with the member's name); the sheet keeps it so the member sees where it goes.
const whoAmI = (o) => {
  const me = o.me || o.hold;
  if (me) return `I'm ${me}${o.what ? `, ${o.what}` : ''}.`;
  if (!o.what) return '';
  return /^(a|an|the)\s/i.test(o.what) ? `I'm ${o.what}.` : `I'm ${text.withA(o.what)}.`;
};

function messagesFor(s, o) {
  const f = s.fixes.length ? s.fixes : [{ title: 'Tighten up a few product pages', evidence: '' }];
  const seed = s.domain || s.name;
  const subject = text.pickBy(seed, [`${s.name}: ${f.length} fixes I spotted`, `A short audit of ${s.name}`, `Quick notes on ${poss(s.name)} product pages`]);
  const opener = text.pickBy(`${seed}:o`, [
    `I read ${poss(s.name)} public product pages this week and wrote up a short audit.`,
    `I went through ${poss(s.name)} online store the way a new shopper would.`,
    `I took a look at ${poss(s.name)} store and wrote down what I noticed.`,
  ]);
  const list = f.map((x, i) => `${i + 1}. ${x.title}${x.evidence ? `. ${mine(x.evidence)}` : '.'}`).join('\n');
  const show = o.mock && s.mock ? `I also mocked up how your ${s.target || 'top product'} page could look with those changes. ` : '';
  const price = o.price ? `I can make these changes for ${money.usd(o.price)}, one flat price for the job, finished within ${text.plural(o.days, 'day')}. If you're not happy with it, I'll redo it at no charge or refund my fee.` : `I'd be glad to make these changes for one flat price, finished within ${text.plural(o.days, 'day')}.`;
  // Every email, follow-ups too, ends with name, business, mailing address and the no-thanks line (D28).
  const footer = `${[o.me || o.hold, o.business].filter(Boolean).concat(o.address || outreach.ADDRESS_HOLD).join('\n')}\n\n${outreach.OPT_OUT}`;
  const email = [
    `Hi ${s.name} team,`,
    '',
    `${whoAmI(o)} ${opener} The three things I'd fix first:`.trim(),
    '',
    list,
    '',
    `${show}${price}`,
    '',
    'Want me to send the full report? It is yours either way.',
    '',
    footer,
  ].join('\n');
  const dm = `Hi! ${whoAmI(o)} I read ${poss(s.name)} product pages and noticed this: ${lower(mine(f[0].evidence || f[0].title))}. I wrote a short audit with the fixes in order. Want me to send it over? No cost for the audit.`;
  const quick = f.slice().sort((a, b) => (a.minutes || 99) - (b.minutes || 99))[0];
  const follow = `Hi ${s.name} team, following up on the audit I sent. The quickest win is "${lower(quick.title)}". Happy to send the report, or to make the changes ${o.price ? `for ${money.usd(o.price)}` : 'for you'}.`;
  // A store with an Instagram and no email seen gets the follow-up as a DM; everyone else by email.
  const byEmail = !!s.email || !s.instagram;
  return { subject, email, dm: dm.replace(/ {2,}/g, ' '), follow: byEmail ? `${follow}\n\n${footer}` : follow };
}

module.exports = {
  name: 'shop.write_pitch',
  title: 'Write store pitches',
  description: 'Writes an email, an Instagram DM and a follow-up for each store from its audit, plus one pipeline sheet with every store, its gaps, the report to show and the follow-up date.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 2,
  input: {
    type: 'object',
    properties: {
      stores: { type: 'array', description: 'Ranked stores (shop.rank_stores) or audits (shop.audit).' },
      price: { type: 'number', minimum: 0, maximum: 100000, description: 'Your flat price for the fix job.' },
      days: { type: 'integer', minimum: 1, maximum: 60, default: 5 },
      what: { type: 'string', maxLength: 120, description: 'How you describe yourself, like "a Shopify designer in Asheville".' },
      address: { type: 'string', maxLength: 200, description: 'Your mailing address for the email footer (US law asks for one in sales emails).' },
      mock: { type: 'object', description: 'The mock page from shop.mock_page (optional).' },
      pipeline: { type: 'boolean', default: false, description: 'Save each store to your Pipeline with its messages, for Do my day.' },
    },
    required: ['stores'],
  },
  output: { type: 'object', properties: { items: { type: 'array' }, sheet: { type: 'object' }, count: { type: 'integer' }, saved: { type: 'integer' }, sample: { type: 'boolean' } }, required: ['items'] },

  async run(input, ctx) {
    const br = brain.brainOf(ctx, {});
    const me = br.firstName || '';
    const o = {
      me: me ? `${me}` : '',
      business: br.name,
      what: input.what || (br.city ? `a Shopify designer in ${br.city}` : 'a Shopify designer'),
      price: input.price != null ? input.price : null,
      days: input.days || 5,
      address: input.address || '',
      mock: input.mock || null,
      hold: '[your name]',
    };
    const stores = (input.stores || []).map(normalize).filter((s) => s && s.ok && s.name).slice(0, 25);
    if (input.mock && stores[0]) stores[0].mock = input.mock;
    const today = time.today(ctx);
    const followOn = time.addDays ? time.addDays(today, 3) : today;
    const items = stores.map((s, i) => {
      const m = messagesFor(s, o);
      return {
        rank: i + 1,
        label: s.name,
        url: s.url,
        email: s.email,
        instagram: s.instagram,
        subject: m.subject,
        text: m.email,
        dm: m.dm,
        follow_up: m.follow,
        follow_up_on: followOn,
        show: s.report ? s.report.name : '',
        source: s.source || 'you',
        ...(s.searchBy ? { searchBy: s.searchBy } : {}),
        sample: !!s.sample,
      };
    });
    let sheet = null;
    // OpenStreetMap's credit is the sheet's last row when any store came from it (D27, ODbL).
    const credit = places.creditLine(items);
    if (items.length) {
      sheet = await save.saveFile(
        ctx,
        items.length === 1 ? save.fileName(items[0].label, 'pitch', '.csv') : save.fileName(br.name || 'my', 'first 25 stores', '.csv'),
        files.csv(credit ? items.concat([{ rank: credit }]) : items, [
          { key: 'rank', label: '#' },
          { key: 'label', label: 'Store' },
          { key: 'url', label: 'Website' },
          { key: 'email', label: 'Email seen on site' },
          { key: 'instagram', label: 'Instagram' },
          ...(items.some((i) => i.show) ? [{ key: 'show', label: 'Report to send' }] : []),
          { key: 'subject', label: 'Email subject' },
          { key: 'text', label: 'Email' },
          { key: 'dm', label: 'DM' },
          { key: 'follow_up_on', label: 'Follow up on' },
          { key: 'follow_up', label: 'Follow-up message' },
        ]),
        'text/csv'
      );
    }
    // Each store as a Pipeline row (contract 13): the messages without placeholders, the audit's top
    // fixes as the facts the message cites, and the channel the first message goes by.
    let saved = 0;
    if (input.pipeline && ctx.leads && typeof ctx.leads.upsert === 'function') {
      for (const s of stores) {
        const m = messagesFor(s, { ...o, hold: '' });
        const links = { website: s.url };
        if (s.email) links.email = s.email;
        if (s.instagram) links.instagram = `https://www.instagram.com/${String(s.instagram).replace(/^@/, '')}/`;
        if (s.phone) links.phone = s.phone;
        const facts = s.fixes.map((f) => text.clip(text.plain(factOf(f.evidence || f.title)), 160)).filter(Boolean).slice(0, 5);
        try {
          await ctx.leads.upsert({
            key: s.key || `url:${s.domain}`,
            name: text.clip(s.name, 120),
            company: text.clip(s.name, 120),
            source: text.clip(`Shopify store finder${s.sample ? ' (sample)' : ''}`, 60),
            stage: 'found',
            links,
            note: text.clip(s.fixes.map((f) => f.title).join('. '), 1000),
            score: Math.max(0, Math.min(100, Math.round(s.opportunity != null ? s.opportunity : 100 - (s.score || 0)))),
            channel: s.email ? 'email' : s.instagram ? 'ig' : 'site',
            facts,
            msg: { subject: m.subject, email: m.email, dm: m.dm, follow1: m.follow },
            data: { domain: s.domain || null, auditScore: s.score != null ? s.score : null, fixes: s.fixes.map((f) => f.id).filter(Boolean), sample: !!s.sample, placeSource: s.source || 'you', ...(s.searchBy ? { searchBy: s.searchBy } : {}) },
          });
          saved++;
        } catch {
          /* one bad row doesn't stop the rest */
        }
      }
    }
    ctx.log(`Wrote ${text.plural(items.length, 'pitch', 'pitches')}${saved ? ` and saved ${saved} to your Pipeline` : ''}.`);
    return { items, sheet, count: items.length, saved, sample: items.some((i) => i.sample) };
  },

  view(out) {
    return views.blocks(
      views.sampleNote(out, 'This pitch list'),
      views.metric('Pitches ready', out.count, out.saved ? `${text.plural(out.saved, 'store')} saved to your Pipeline, so Do my day hands them out. When one asks for the full report, run Audit a store on its address.` : out.items.some((i) => i.show) ? 'Edit, then send from your own email or Instagram. Attach each store its report.' : 'Edit, then send from your own email or Instagram. When one asks for the full report, run Audit a store on its address.'),
      views.file(out.sheet, 'Pipeline sheet: every store, its report, messages and follow-up date'),
      out.items.slice(0, 5).flatMap((i) => [views.copy(`Email to ${i.label}`, `Subject: ${i.subject}\n\n${i.text}`), views.copy(`DM to ${i.label}`, i.dm)]),
      places.creditBlocks(out.items)
    );
  },
};
