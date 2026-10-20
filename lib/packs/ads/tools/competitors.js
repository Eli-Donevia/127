// Ideas from other businesses' ads (Legal D11): the member pastes ad text or Ad Library links, and gets
// back the angles and the structure those ads use, then their own version of each angle written from
// their own facts. Never the other ads' words, images or video, and never another brand's name: every
// line out is checked against the pasted text (no run of 4 words in common, no names from it). Links
// aren't opened: the Ad Library needs Meta's app, which this version doesn't have.

const { text, views, save } = require('../../_kit');
const A = require('../lib/ads');
const C = require('../lib/claims');
const { page, esc, table } = require('../lib/page');
const { NUM_INPUTS, SERVICE } = require('./desk');

const ANGLE_WORDS = {
  price: /\$\s?\d|\bprice[sd]?\b|\bcosts?\b|\bquote\b|\bestimate\b|\bfrom \$|\bstarting at\b/i,
  local: /\bnear (you|me)\b|\blocal\b|\bneighbou?rs?\b|\bin (your|our) (area|town|city|neighborhood)\b|\bserving\b/i,
  proof: /\bbefore\b[^.!?]{0,20}\bafter\b|\btransform|\bresults?\b|\bsee the difference\b|\bwatch\b/i,
  time: /\bsave (time|hours?)\b|\bhassle\b|\bweekend\b|\bcome to you\b|\bmobile\b|\bon[- ]site\b|\bin \d+ minutes\b|\bfast\b|\bquick\b|\beasy\b/i,
  included: /\binclud(es|ed|ing)\b|\bevery(thing)?\b[^.!?]{0,20}\b(get|included)\b|\bpackage\b|\bwhat you get\b|\bfull\b/i,
  who: /\bfor (busy|new|first[- ]time|every|all)\b|\bif you\b|\bparents?\b|\bmoms?\b|\bdads?\b|\bhomeowners?\b|\bowners?\b|\bstudents?\b/i,
};
const EXTRA = {
  discount: /\b\d+% off\b|\bdiscount\b|\bdeal\b|\bspecial\b|\bfree\b|\bsave \$/i,
  pressure: /\btoday only\b|\blimited\b|\bhurry\b|\bspots? left\b|\bends\b|\blast chance\b|\bdon'?t miss\b/i,
  reviews: /\breviews?\b|\bstars?\b|\brated\b|\b\d[\d,]*\+? (happy )?(customers|clients)\b|["“]/i,
};
const CTA = [
  [/\bbook\b/i, 'Book'],
  [/\bcall\b|\btext\b/i, 'Call or text'],
  [/\b(get|request) a (quote|estimate)\b/i, 'Get a quote'],
  [/\bshop\b|\bbuy\b|\border\b/i, 'Shop'],
  [/\bmessage\b|\bdm\b/i, 'Message'],
  [/\blearn more\b|\bsee more\b/i, 'Learn more'],
];
const COMMON = new Set('a an the and or but if of to in on at for with from by your you our we us it this that is are be was were i my me they them their there here what who how when why all any each more most just only not no so as up out about into over than too very can will do does did have has had get got make made new one two three four five day days week time free off now today near best great good book call text shop order learn see save try start join visit message quote price prices deal sale offer special limited schedule appointment appointments service services tomorrow weekend local family owned home mobile clean cleaning detail detailing wash washing lawn care repair team pro pros now click link bio here'.split(' '));

// One pasted ad or link per block: blank lines or a line of dashes between them.
function split(raw) {
  return String(raw || '').split(/\n\s*(?:-{3,}|_{3,})?\s*\n|\r\n\s*\r\n/).map((s) => s.trim()).filter(Boolean).slice(0, 10);
}

const wordsOf = (s) => String(s || '').toLowerCase().replace(/https?:\/\/\S+/g, ' ').match(/[a-z0-9$']+/g) || [];

// What can never come back out: every 4-word run in their ads, their names and their domains.
function fingerprint(blocks, own = '') {
  const grams = new Set();
  const names = new Set();
  const mine = new Set(wordsOf(own));
  for (const b of blocks) {
    const w = wordsOf(b);
    for (let i = 0; i + 4 <= w.length; i++) grams.add(w.slice(i, i + 4).join(' '));
    for (const m of b.matchAll(/https?:\/\/(?:www\.)?([a-z0-9-]+)\./gi)) if (!/^(facebook|fb|instagram|tiktok|google|m)$/i.test(m[1])) names.add(m[1].toLowerCase());
    const caps = [...b.matchAll(/\b([A-Z][a-zA-Z'&]+(?:\s+[A-Z][a-zA-Z'&]+)+)/g), ...b.matchAll(/[^.!?\n:]\s([A-Z][a-zA-Z'&]+)/g)];
    for (const m of caps) {
      for (const word of m[1].split(/\s+/)) {
        const k = word.toLowerCase().replace(/'s$/, '');
        if (k.length > 2 && !COMMON.has(k) && !mine.has(k)) names.add(k);
      }
    }
    for (const m of b.matchAll(/@([a-z0-9_.]+)/gi)) names.add(m[1].toLowerCase());
  }
  return { grams, names };
}

// True when a line of ours shares 4 words in a row, or a name, with their ads.
function copies(line, fp) {
  const w = wordsOf(line);
  for (let i = 0; i + 4 <= w.length; i++) if (fp.grams.has(w.slice(i, i + 4).join(' '))) return true;
  return w.some((x) => fp.names.has(x.replace(/'s$/, '')));
}

function study(block, i) {
  const link = /^https?:\/\/\S+$/.test(block);
  if (link) {
    const lib = /facebook\.com\/ads\/library/i.test(block);
    return { n: i + 1, kind: 'link', words: 0, hook: '', angles: [], cta: '', notes: [lib ? 'An Ad Library link. This version can\'t open the Ad Library (it needs Meta\'s app). Open it yourself, copy the ad\'s words and paste them here.' : 'A link. Links aren\'t opened here: copy the ad\'s words and paste them instead.'] };
  }
  const first = (block.split(/(?<=[.!?])\s+|\n/)[0] || '').trim();
  const words = wordsOf(block).length;
  const hook = /\?$/.test(first) ? 'Opens with a question' : /^[$\d]/.test(first) ? 'Opens with a number or price' : /^(attention|hey|calling all|if you)\b/i.test(first) ? 'Opens by calling out who it is for' : /^(i|we|when i|when we|my|our)\b/i.test(first) ? 'Opens with a short story' : /^(how to|\d+ (ways|tips|reasons))\b/i.test(first) ? 'Opens with a how-to or a list' : 'Opens with a plain statement';
  const angles = Object.entries(ANGLE_WORDS).filter(([, re]) => re.test(block)).map(([k]) => k);
  const cta = (CTA.find(([re]) => re.test(block)) || [null, 'No clear ask'])[1];
  const notes = [`${words < 25 ? 'Short' : words < 80 ? 'Medium length' : 'Long'}: about ${words} words.`];
  if (EXTRA.discount.test(block)) notes.push('Leads with a deal. Your version: a real founding price or a first-visit price, only if you offer one.');
  if (EXTRA.pressure.test(block)) notes.push('Uses a deadline or "spots left". Skip it unless it is true for you.');
  if (EXTRA.reviews.test(block)) notes.push('Leans on reviews, ratings or quotes. Use only your own real reviews, word for word, with the reviewer\'s OK.');
  if ((block.match(/\n/g) || []).length >= 3) notes.push('Broken into short lines, one idea per line.');
  if (/[\u{1F300}-\u{1FAFF}]/u.test(block)) notes.push('Uses emoji as bullets.');
  return { n: i + 1, kind: 'text', words, hook, angles, cta, notes };
}

const studyAds = {
  name: 'ads.study_ads',
  title: 'Study other ads',
  description: "Reads ads you paste from other businesses (the words, or Ad Library links you open yourself) and notes their angles and structure: how each one opens, its length, its ask, and whether it leans on a deal, a deadline or reviews. Then writes your own version of each angle from your own facts. Ideas only: it never copies their words, images or names.",
  kind: 'code',
  risk: 'draft',
  needs: [],
  credits: 2,
  input: {
    type: 'object',
    properties: {
      ads: { type: 'string', format: 'textarea', title: 'Ads to learn from', description: 'Paste the words of up to 10 ads, with a blank line between them, or Ad Library links.', maxLength: 20000 },
      price: NUM_INPUTS.price,
      service: SERVICE,
    },
    required: ['ads'],
  },
  output: {
    type: 'object',
    properties: { ads: { type: 'array' }, common: { type: 'array' }, ideas: { type: 'array' }, page: { type: 'object' } },
    required: ['ads', 'ideas'],
  },
  async run(input, ctx) {
    const f = A.factsOf(ctx, input);
    A.needService(f);
    const blocks = split(input.ads);
    if (!blocks.length) throw new Error('Paste the words of at least one ad.');
    const studied = blocks.map(study);
    const texts = blocks.filter((b, i) => studied[i].kind === 'text');
    const fp = fingerprint(texts, `${f.name} ${f.service} ${f.city} ${f.where} ${f.offer} ${f.audience}`);
    const count = (k) => studied.filter((s) => s.angles.includes(k)).length;
    const mine = A.angles(f);
    const typed = C.typedBy(ctx, input);
    const ideas = mine
      .map((a) => {
        const used = count(a.key);
        let hook = a.hook;
        // D11: never their words or names; D3, D4: our own claims rules.
        if (copies(hook, fp) || !C.check(hook, { typed }).ok) hook = `${text.sentenceCase(f.service)}${f.city ? ` in ${f.city}` : ''}: ${a.name.toLowerCase()}.`;
        return { key: a.key, angle: a.name, used, of: texts.length, hook, why: used ? `${used} of ${texts.length} ads here use it. Yours is built from your own facts.` : `None of these ads use it: room for you to stand out.` };
      })
      .filter((x) => !copies(x.hook, fp))
      .sort((x, y) => (y.used > 0) - (x.used > 0) || y.used - x.used);
    const common = [
      ...Object.keys(ANGLE_WORDS).filter((k) => count(k) >= 2).map((k) => `${count(k)} of ${texts.length} ads use the ${(mine.find((a) => a.key === k) || { name: k }).name.toLowerCase()} angle.`),
      ...[...new Set(studied.filter((s) => s.kind === 'text').map((s) => s.hook))].map((h) => `${studied.filter((s) => s.hook === h).length} ${h.toLowerCase()}.`),
    ].filter((l) => !copies(l, fp));
    const body = `<section><h2>What these ads do</h2><p class="lead">Notes on structure only. Their words, pictures and names stay theirs.</p>${table([{ key: 'n', label: 'Ad' }, { key: 'hook', label: 'How it opens' }, { key: 'angles', label: 'Angles' }, { key: 'cta', label: 'The ask' }, { key: 'notes', label: 'Notes' }], studied.map((s) => ({ ...s, angles: s.angles.map((k) => (mine.find((a) => a.key === k) || { name: k }).name).join(', '), notes: s.notes.join(' ') })))}</section>
<section><h2>Your version of each angle</h2>${ideas.map((x) => `<div class="card"><span class="tag${x.used ? '' : ' ok'}">${esc(x.angle)}</span><h3>${esc(x.hook)}</h3><p class="muted">${esc(x.why)}</p></div>`).join('')}</section>
<section><h2>The rule</h2><div class="card"><p>Other ads are for ideas only. Never copy their words, images or video, and never put another business's name or logo in your ad.</p></div></section>`;
    const pg = await save.saveFile(ctx, save.fileName(f.name || f.service, 'ad ideas', '.html'), page(ctx, { title: 'Ideas from other ads', kicker: 'Ad ideas', sub: `${text.plural(blocks.length, 'ad')} read for angles and structure. Your versions are written from your own facts.`, stats: [{ value: texts.length, label: 'ads read' }, { value: ideas.filter((x) => !x.used).length, label: 'angles nobody here uses' }], body }));
    ctx.log(`${text.plural(texts.length, 'ad')} studied, ${text.plural(ideas.length, 'angle')} written from your facts.`);
    return { ads: studied, common, ideas, page: pg };
  },
  view(out) {
    return views.blocks(
      views.metric('Ads read', out.ads.filter((a) => a.kind === 'text').length, 'For angles and structure only. Their words stay theirs.'),
      out.common.length ? views.cards(out.common.map((c) => ({ title: 'Common here', body: c }))) : null,
      views.table([{ key: 'angle', label: 'Angle' }, { key: 'hook', label: 'Your version' }, { key: 'why', label: 'Why' }], out.ideas, 6),
      out.ads.filter((a) => a.kind === 'link').map((a) => views.text(a.notes[0])),
      views.file(out.page, 'Notes and your versions (printable)'),
    );
  },
};

module.exports = { studyAds, split, fingerprint, copies, study };
