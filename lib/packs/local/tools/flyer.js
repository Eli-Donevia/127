// local.flyer: print-ready flyer (Letter), door hangers (two 4.25 x 11 in per Letter sheet) and an
// EDDM-size postcard (9 x 6.25 in, front and back with the EDDM Retail indicia), each with a QR code
// to book, see prices or text the member. Static HTML with inline SVG, PNG previews when it can render.

const kit = require('../../_kit');
const { text, views, qr, save } = kit;
const F = require('../lib/facts');

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const art = require('../lib/art');
const page = require('../lib/page');
const C = require('../lib/copy');
const { BIZ, ASSET, ASSETS, typed } = require('../lib/common');
const PRINT = require('../data/print.json');

function defaultCopy(f) {
  const bullets = (f.services || []).filter((s) => s.name).map(F.serviceLine);
  return { headline: f.group.headlines[0], sub: cap(`${f.what || f.group.label}${f.city ? ` around ${f.city}` : ''}.`), bullets: (bullets.length ? bullets : f.group.bullets).slice(0, 3), offerText: f.founding || '', cta: '' };
}

module.exports = {
  name: 'local.flyer',
  title: 'Make print flyers',
  description: 'Draws a Letter flyer, two-up door hangers and an EDDM-size postcard in your colors, each with a QR code to book, see prices or text you, your phone in big type and your real offer. Print-ready HTML with PNG previews.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  wants: ['render'],
  credits: 2,
  timeoutSec: 120,
  input: {
    type: 'object',
    properties: {
      ...BIZ,
      copy: { type: 'object', description: 'Flyer copy: the approve step output, one option, or { headline, sub, bullets, offerText, cta }' },
      offer: { type: 'string', title: 'Your offer (optional)', maxLength: 60 },
      area: { type: 'string', title: 'Streets or neighborhood (optional)', maxLength: 80 },
      formats: { type: 'string', enum: ['all', 'flyer', 'door_hanger', 'postcard'], default: 'all', title: 'What to make' },
      campaign: { type: 'string', title: 'Campaign name for the link (optional)', maxLength: 40, default: 'flyer' },
    },
  },
  output: {
    type: 'object',
    required: ['files'],
    properties: {
      copy: { type: 'object' },
      action: { type: 'object' },
      files: { type: 'object', properties: { flyer: ASSET, doorHangers: ASSET, postcard: ASSET, previews: ASSETS } },
      qr: { type: 'object' },
      print: { type: 'array', items: { type: 'string' } },
      eddm: { type: 'object' },
      sample: { type: 'boolean' },
    },
  },
  async run(input, ctx) {
    const f = F.factsOf(ctx, input);
    await F.saveSettings(ctx, typed(input));
    const c = C.normalize(input.copy) || defaultCopy(f);
    if (!c.headline) Object.assign(c, defaultCopy(f));
    if (input.offer) c.offerText = text.clip(text.plain(input.offer), 60);
    const action = F.actionLink(f, { campaign: input.campaign || 'flyer' });
    const copy = { eyebrow: f.name, headline: c.headline, sub: c.sub, bullets: c.bullets, offer: C.offerParts(c.offerText), cta: c.cta || (action && action.label), area: input.area || f.area || f.city, backline: c.sub && c.sub.length < 70 ? c.sub : c.headline };
    const want = input.formats || 'all';
    const base = save.fileName(f.name, input.campaign || 'flyer');
    const out = { files: { previews: [] } };
    const modules = [];
    if (want === 'all' || want === 'flyer') {
      const d = art.flyer(f, copy, action);
      modules.push(d.module);
      const r = await page.savePrintable(ctx, { base: `${base}-flyer`, title: `${f.name}: flyer`, pages: [d], notes: ['Letter size. Print at 100% (Actual size). Color copies at a print shop look sharper than most home printers.', 'Scan the QR code with your phone before you print a stack.'] });
      out.files.flyer = r.html;
      out.files.previews.push(...r.png);
    }
    if (want === 'all' || want === 'door_hanger') {
      const d = art.doorHangerSheet(f, copy, action);
      modules.push(d.module);
      const r = await page.savePrintable(ctx, { base: `${base}-door-hangers`, title: `${f.name}: door hangers`, pages: [d], notes: ['Two door hangers per Letter sheet. Print on heavy card stock at 100%, cut down the middle, then cut out each hole and the slit along the dashed lines.', 'Hang them on the door handle only. Never put anything in or on a mailbox: that is against federal law (18 U.S.C. 1725).', 'Skip homes with a No soliciting sign.'] });
      out.files.doorHangers = r.html;
      out.files.previews.push(...r.png);
    }
    if (want === 'all' || want === 'postcard') {
      const front = art.postcardFront(f, copy);
      const back = art.postcardBack(f, copy, action, { eddm: true });
      modules.push(back.module);
      const r = await page.savePrintable(ctx, {
        base: `${base}-postcard`,
        title: `${f.name}: EDDM postcard`,
        pages: [front, back],
        previews: [0, 1],
        notes: [`9 by 6.25 inches, a size that qualifies as an EDDM flat. ${PRINT.eddm.price_quote} Check current rates at the post office before you print.`, `${PRINT.eddm.volume} Address: ${PRINT.eddm.address}.`, 'Most print shops print EDDM postcards with bleed. Send them this page and ask for 9 x 6.25 in on 14 pt card stock.'],
      });
      out.files.postcard = r.html;
      out.files.previews.push(...r.png);
    }
    const mod = modules.filter(Boolean);
    const m = action ? qr.qrMatrix(action.url, { ecc: 'M' }) : null;
    return {
      copy: { ...c, offer: copy.offer },
      action: action || { kind: 'none', url: '', label: '' },
      files: out.files,
      qr: m ? { version: m.version, modules: m.size, smallestModuleMm: Math.round((Math.min(...mod) * 25.4 / 96) * 100) / 100, minInches: qr.minPrintInches(action.url, { ecc: 'M' }) } : {},
      print: [
        'Print at 100% (Actual size), never Fit to page.',
        action ? `The QR code opens ${action.kind === 'text' ? `a text to ${action.short}` : action.short}. Scan a printed copy before you hand any out.` : 'Add a phone, website or booking link so the flyer gets a QR code.',
        'Hand flyers to people, post them where boards allow it, and hang door hangers on handles. Never use mailboxes.',
        'Go steady: 25 a day on the streets you want, and keep a tally of calls by street so you know where to go back.',
      ],
      eddm: { size: '9 x 6.25 in', price: PRINT.eddm.price, volume: PRINT.eddm.volume, address: PRINT.eddm.address, checked: PRINT.checked, url: (PRINT.eddm.tool_url || PRINT.eddm.source || '') },
      sample: !f.hasName,
    };
  },
  view(out) {
    const p = (out.files && out.files.previews) || [];
    return views.blocks(
      views.image(p[0], 'Flyer'),
      views.file(out.files && out.files.flyer, 'Flyer (Letter): open, then Print at 100%'),
      views.image(p[1], 'Door hangers, two per sheet'),
      views.file(out.files && out.files.doorHangers, 'Door hangers (two per Letter sheet)'),
      views.image(p[3] || p[2], 'Postcard back with the EDDM indicia'),
      views.file(out.files && out.files.postcard, 'EDDM postcard, front and back'),
      out.action && out.action.url ? views.copy('Your QR code opens', out.action.url) : null,
      views.text(out.print.join(' '))
    );
  },
};
