// "Show your work" for a household pack: one finished job turned into proof the member can use
// today. A result card (PNG) from what they typed, a before-and-after collage when they add two
// photos, a post caption, an honest review ask with nothing attached, and the ask for permission to
// share. The case study waits for the customer's written yes (an approve step), says so when it was a
// founding or free job (FTC endorsement guides, 16 CFR 255.5), and only uses words and numbers the
// member typed. Shared household spine.

const { text, views, save, media, svg, time } = require('..');
const print = require('./print');
const pages = require('./pages');
const photos = require('./photos');
const pipe = require('./pipeline');
const T = require('./tools');

const ASSET = { type: 'object', properties: { id: { type: 'string' }, url: { type: 'string' }, name: { type: 'string' }, type: { type: ['string', 'null'] }, bytes: { type: 'number' } } };
const DEALS = ['Full price', 'Founding or early price', 'Free sample'];

const W = 1080;
const H = 1350;

// The card from typed words only: what was done, the result, the time, the area.
function resultSvg(cfg, o, pal) {
  const pad = 80;
  const body = [];
  body.push(svg.rect({ x: 0, y: 0, w: W, h: 190, fill: pal.primary }));
  body.push(svg.icon(cfg.niche.icon || 'sparkle', { x: pad, y: 52, size: 80, color: pal.onPrimary, weight: 1.8 }));
  const biz = svg.fit(o.business, { width: W - pad * 2 - 110, height: 80, maxSize: 50, minSize: 28, maxLines: 1, weight: 800 });
  body.push(svg.text({ x: pad + 110, y: 112, lines: biz.lines, size: biz.size, weight: 800, fill: pal.onPrimary }));
  if (o.area) body.push(svg.text({ x: pad + 110, y: 156, lines: [o.area], size: 28, weight: 500, fill: pal.onPrimary, opacity: 0.85 }));
  let y = 300;
  body.push(svg.text({ x: pad, y, lines: [o.eyebrow || 'Just finished'], size: 34, weight: 700, fill: pal.primary }));
  y += 30;
  if (o.photo) {
    body.push(`<clipPath id="ph"><rect x="${pad}" y="${y}" width="${W - pad * 2}" height="430" rx="24"/></clipPath>`);
    body.push(`<g clip-path="url(#ph)">${svg.image({ x: pad, y, w: W - pad * 2, h: 430, data: o.photo.data, type: o.photo.type })}</g>`);
    body.push(svg.rect({ x: pad, y, w: W - pad * 2, h: 430, r: 24, fill: 'none', stroke: pal.line || '#d9d9d9', strokeWidth: 2 }));
    y += 430 + 40;
  }
  const head = svg.fit(o.what, { width: W - pad * 2, height: o.photo ? 160 : 260, maxSize: o.photo ? 64 : 88, minSize: 40, maxLines: 3, weight: 800 });
  y += head.size * 0.85;
  body.push(svg.text({ x: pad, y, lines: head.lines, size: head.size, weight: 800, fill: pal.ink, lineHeight: 1.06 }));
  y += head.size * 1.06 * (head.lines.length - 1) + 50;
  for (const line of o.lines.slice(0, o.photo ? 2 : 4)) {
    body.push(svg.icon('check', { x: pad, y: y - 34, size: 44, color: pal.primary, weight: 2.2 }));
    const l = svg.fit(line, { width: W - pad * 2 - 70, height: 96, maxSize: 38, minSize: 26, maxLines: 2, weight: 500 });
    body.push(svg.text({ x: pad + 66, y, lines: l.lines, size: l.size, weight: 500, fill: pal.ink, lineHeight: 1.2 }));
    y += l.size * 1.2 * l.lines.length + 26;
  }
  if (o.quote) {
    const q = svg.fit(`"${o.quote}"`, { width: W - pad * 2 - 40, height: 150, maxSize: 34, minSize: 24, maxLines: 3, weight: 500 });
    body.push(svg.rect({ x: pad, y: y - 10, w: 8, h: q.size * 1.3 * q.lines.length + 10, fill: pal.primary }));
    body.push(svg.text({ x: pad + 34, y: y + q.size * 0.8, lines: q.lines, size: q.size, weight: 500, fill: pal.muted, lineHeight: 1.3 }));
  }
  body.push(svg.rect({ x: 0, y: H - 170, w: W, h: 170, fill: pal.ink }));
  body.push(svg.text({ x: pad, y: H - 92, lines: [o.cta], size: 50, weight: 800, fill: '#ffffff' }));
  body.push(svg.text({ x: pad, y: H - 44, lines: [o.sub || ''], size: 28, weight: 500, fill: '#ffffff', opacity: 0.8 }));
  return svg.doc({ width: W, height: H, background: pal.paper, body: body.join(''), title: `${o.business}: ${o.what}` });
}

// Two photos side by side (4:5 each, so a phone photo keeps most of its frame), labeled at the top
// so a photo's own corner stays clear, then what changed and how to book, in the member's colors.
const PANEL = { w: 504, h: 630 };
function collageSvg(cfg, o, pal) {
  const pad = 24;
  const top = 160;
  const body = [];
  body.push(svg.rect({ x: 0, y: 0, w: W, h: top, fill: pal.primary }));
  const head = svg.fit(o.what, { width: W - 120, height: 70, maxSize: 46, minSize: 26, maxLines: 1, weight: 800 });
  body.push(svg.text({ x: 60, y: 76, lines: head.lines, size: head.size, weight: 800, fill: pal.onPrimary }));
  body.push(svg.text({ x: 60, y: 124, lines: [o.business + (o.area ? `, ${o.area}` : '')], size: 28, weight: 500, fill: pal.onPrimary, opacity: 0.88 }));
  const py = top + pad;
  [['Before', o.before, pad], ['After', o.after, pad * 2 + PANEL.w]].forEach(([label, img, x], i) => {
    body.push(`<clipPath id="p${i}"><rect x="${x}" y="${py}" width="${PANEL.w}" height="${PANEL.h}" rx="18"/></clipPath>`);
    body.push(`<g clip-path="url(#p${i})">${svg.image({ x, y: py, w: PANEL.w, h: PANEL.h, data: img.data, type: img.type })}</g>`);
    body.push(svg.pill({ x: x + 20, y: py + 20, label: label.toUpperCase(), size: 28, weight: 800, fill: i ? pal.primary : '#111111', color: '#ffffff' }).svg);
  });
  // What changed, from the member's own words, between the photos and the footer.
  let y = py + PANEL.h + 74;
  const floor = H - 170 - 30;
  for (const line of (o.lines || []).slice(0, 2)) {
    const l = svg.fit(line, { width: W - 120 - 66, height: 96, maxSize: 36, minSize: 26, maxLines: 2, weight: 500 });
    if (y + l.size * 1.2 * (l.lines.length - 1) > floor) break;
    body.push(svg.icon('check', { x: 60, y: y - 33, size: 42, color: pal.primary, weight: 2.2 }));
    body.push(svg.text({ x: 60 + 64, y, lines: l.lines, size: l.size, weight: 500, fill: pal.ink, lineHeight: 1.2 }));
    y += l.size * 1.2 * l.lines.length + 24;
  }
  body.push(svg.rect({ x: 0, y: H - 170, w: W, h: 170, fill: pal.ink }));
  body.push(svg.text({ x: 60, y: H - 92, lines: [o.cta], size: 50, weight: 800, fill: '#ffffff' }));
  body.push(svg.text({ x: 60, y: H - 44, lines: [o.sub || ''], size: 28, weight: 500, fill: '#ffffff', opacity: 0.8 }));
  return svg.doc({ width: W, height: H, background: pal.paper, body: body.join(''), title: `${o.business}: before and after` });
}

async function png(ctx, svgText) {
  return media.svgToPng(ctx, svgText);
}

// The member's typed facts, cleaned: never a number they didn't type.
function typedFacts(input) {
  const clean = (s, n) => text.clip(text.plain(String(s || '')).trim(), n);
  return {
    customer: clean(input.customer, 120),
    what: clean(input.what, 120),
    result: clean(input.result, 240),
    took: clean(input.took, 60),
    area: clean(input.area, 60),
    quote: clean(input.quote, 280).replace(/^["“]|["”]$/g, ''),
    deal: DEALS.includes(input.deal) ? input.deal : '',
  };
}

// The deal behind this job: what the member picked, else what "A customer said yes" logged.
function dealOf(t, lead) {
  if (t.deal) return t.deal;
  const step = lead && lead.data && lead.data.job && lead.data.job.step;
  if (step === 'founding' || step === 'early') return DEALS[1];
  if (lead && lead.data && lead.data.sample && lead.stage !== 'won') return DEALS[2];
  return DEALS[0];
}

function cardTool(cfg) {
  const id = cfg.id;
  const N = cfg.niche;
  const P = N.proof || {};
  return {
    name: `${id}.result_card`,
    title: 'Result card and collage',
    description: 'A result card from what you typed, a before-and-after collage from two photos you add, a post caption, an honest review ask with nothing attached, and the ask for permission to share. No number you did not type.',
    kind: 'code',
    risk: 'draft',
    needs: [],
    wants: ['render'],
    credits: 3,
    timeoutSec: 150,
    input: {
      type: 'object',
      required: ['what'],
      properties: {
        what: { type: 'string', maxLength: 120, title: 'What you did' },
        customer: { type: 'string', maxLength: 120, title: 'Customer (optional)' },
        result: { type: 'string', maxLength: 240, title: 'What changed (optional)' },
        took: { type: 'string', maxLength: 60, title: 'How long it took (optional)' },
        area: { type: 'string', maxLength: 60, title: 'Neighborhood or town (optional)' },
        quote: { type: 'string', maxLength: 280, title: 'What they said (optional)' },
        deal: { type: 'string', enum: DEALS, title: 'Their price (optional)' },
        before: { type: 'string', title: 'Before photo (optional)' },
        after: { type: 'string', title: 'After photo (optional)' },
        review: { type: 'string', maxLength: 300, title: 'Your review link (optional)' },
        city: { type: 'string', maxLength: 80 },
        business: { type: 'string', maxLength: 80 },
        phone: { type: 'string', maxLength: 40 },
        link: { type: 'string', maxLength: 300 },
        color: { type: 'string', maxLength: 7 },
      },
    },
    output: {
      type: 'object',
      required: ['what', 'messages', 'files', 'share'],
      properties: { what: { type: 'string' }, customer: { type: 'string' }, deal: { type: 'string' }, messages: { type: 'array' }, share: { type: 'array' }, files: { type: 'object', properties: { card: ASSET, collage: ASSET, svg: ASSET } }, notes: { type: 'array' } },
    },
    async run(input, ctx) {
      const f = T.facts(ctx, cfg, input);
      const t = typedFacts(input);
      if (!t.what) throw new Error(`Type what you did, like "${P.what || 'the job'}".`);
      const lead = t.customer ? await pipe.findLead(ctx, id, t.customer) : null;
      const first = t.customer ? t.customer.split(/\s+/)[0] : '';
      const deal = dealOf(t, lead);
      const area = t.area || (f.area !== 'town' ? f.area : '');
      const pal = print.paletteFor(cfg, input.color);
      const lines = [t.result, t.took ? `Done in ${t.took.replace(/^in\s+/i, '')}` : ''].filter(Boolean);
      const cta = f.phone ? `Text ${f.phone}` : f.link ? 'Book online' : `Ask ${f.first || 'me'} for a spot`;
      const sub = f.link && f.phone ? f.link.replace(/^https?:\/\//, '') : `${N.name}${area ? ` in ${area}` : ''}`;
      const notes = [];
      const out = { what: t.what, customer: t.customer, deal, files: {}, notes };

      // Photos (optional): both make the collage, one goes on the card.
      let before = null;
      let after = null;
      let cardPhoto = null;
      const render = media.canRender(ctx);
      if ((input.before || input.after) && render) {
        try {
          // The card shows the after photo (or the only one); the collage needs both.
          cardPhoto = await photos.panel(ctx, input.after || input.before, { w: W - 160, h: 430, label: input.after ? 'after photo' : 'photo' });
          if (input.before && input.after) {
            before = await photos.panel(ctx, input.before, { ...PANEL, label: 'before photo' });
            after = await photos.panel(ctx, input.after, { ...PANEL, label: 'after photo' });
          }
        } catch (e) {
          if (ctx.signal && ctx.signal.aborted) throw new Error('Stopped.');
          notes.push(`${e.message} The card was made without it.`);
          before = null;
          after = null;
          cardPhoto = null;
        }
      } else if (input.before || input.after) notes.push("Photos can't be processed right now, so the card was made without them.");

      const cardSvg = resultSvg(cfg, { business: f.business, area: `${N.name}${area ? ` in ${area}` : ''}`, eyebrow: cardPhoto && input.after ? 'After' : 'Just finished', what: t.what, lines, quote: '', photo: cardPhoto, cta, sub }, pal);
      if (render) {
        try {
          out.files.card = await save.saveFile(ctx, save.fileName(f.business, 'result card', '.png'), await png(ctx, cardSvg));
          if (before && after) out.files.collage = await save.saveFile(ctx, save.fileName(f.business, 'before and after', '.png'), await png(ctx, collageSvg(cfg, { business: f.business, area, what: t.what, lines, before, after, cta, sub }, pal)));
        } catch {
          /* the SVG below still works */
        }
      }
      if (!out.files.card) out.files.svg = await save.saveFile(ctx, save.fileName(f.business, 'result card', '.svg'), cardSvg);

      // The words: caption, honest review ask, and the permission ask.
      const thing = P.thing || 'place';
      const caption = text.plain([`${t.what}${area ? ` in ${area}` : ''}.`, t.result ? `${t.result.replace(/\.$/, '')}.` : '', t.took ? `Done in ${t.took.replace(/^in\s+/i, '')}.` : '', `${N.offer.promise}`, f.phone ? `Text ${f.phone} to book.` : 'Message me to book.'].filter(Boolean).join(' '));
      const review = /^https:\/\/\S+$/.test(String(input.review || '').trim()) ? String(input.review).trim() : '';
      const K = (N.texts && N.texts.keep) || {};
      const messages = [
        { key: 'caption', label: before ? 'Caption for the before and after' : 'Caption for the card', text: caption },
        { key: 'permission', label: `Ask ${first || 'them'} before you share`, text: text.plain(`Hi ${first || 'there'}, it's ${f.first || f.business}${f.first ? ` from ${f.business}` : ''}. Could I share the before and after photos of your ${thing} on my page? ${P.private || 'No faces or house numbers.'}${t.quote ? ` And could I quote what you said: "${t.quote}"?` : ''} Just reply yes or no, either is completely fine.`) },
        { key: 'review', label: 'Honest review ask (nothing offered for it)', text: text.plain(`Hi ${first || 'there'}, it's ${f.first || f.business}${f.first ? ` from ${f.business}` : ''}. If you have a minute, would you leave an honest review of how it went? Good or bad, it helps me get better and helps neighbors decide.${review ? ` Here's the link: ${review}` : ''}`) },
      ];
      out.messages = messages;
      out.rules = K.rules || 'Ask every customer for a review, happy or not, and never offer anything for one. Only share photos the customer said yes to.';
      out.share = [
        { label: `Yes, in writing, with ${first ? `${first}'s` : 'their'} first name`, share: 'named' },
        { label: 'Yes, in writing, but no name', share: 'anonymous' },
        { label: 'Not yet', share: '' },
      ];
      out.area = area;
      return out;
    },
    view(out) {
      return views.blocks(
        views.image(out.files.collage, 'Before and after: post it once they say yes'),
        views.image(out.files.card, 'Result card: share it once they say yes'),
        out.files.svg ? views.file(out.files.svg, 'Result card (open in a browser)') : null,
        out.messages.map((m) => views.copy(m.label, m.text)),
        views.text(out.rules),
        (out.notes || []).map((n) => views.text(n)),
      );
    },
  };
}

// The case study page, made only after the customer's written yes.
function caseTool(cfg) {
  const id = cfg.id;
  const N = cfg.niche;
  return {
    name: `${id}.case_study`,
    title: 'Write the case study',
    description: 'A one-page case study from one job, made after the customer said yes in writing: their before and after, what you did, the result in your words, their quote when you have it, and a plain note when it was a founding or free job.',
    kind: 'code',
    risk: 'draft',
    needs: [],
    wants: ['render'],
    credits: 2,
    timeoutSec: 120,
    input: {
      type: 'object',
      required: ['card', 'share'],
      properties: {
        card: { type: 'object', title: 'The result card step' },
        share: { type: 'string', enum: ['named', 'anonymous'], title: 'What they said yes to' },
        what: { type: 'string', maxLength: 120 },
        customer: { type: 'string', maxLength: 120 },
        result: { type: 'string', maxLength: 240 },
        took: { type: 'string', maxLength: 60 },
        quote: { type: 'string', maxLength: 280 },
        before: { type: 'string' },
        after: { type: 'string' },
        city: { type: 'string', maxLength: 80 },
        business: { type: 'string', maxLength: 80 },
        phone: { type: 'string', maxLength: 40 },
        link: { type: 'string', maxLength: 300 },
        color: { type: 'string', maxLength: 7 },
      },
    },
    output: { type: 'object', required: ['files'], properties: { title: { type: 'string' }, disclosure: { type: 'string' }, files: { type: 'object', properties: { html: ASSET } }, post: { type: 'string' } } },
    async run(input, ctx) {
      const f = T.facts(ctx, cfg, input);
      const card = input.card || {};
      const t = typedFacts({ ...input, what: input.what || card.what, customer: input.customer || card.customer, deal: card.deal });
      const share = input.share === 'named' ? 'named' : 'anonymous';
      const first = t.customer ? t.customer.split(/\s+/)[0] : '';
      const who = share === 'named' && first ? first : `A customer${card.area ? ` in ${card.area}` : ''}`;
      const area = card.area || (f.area !== 'town' ? f.area : '');
      let collage = null;
      if (input.before && input.after && media.canRender(ctx)) {
        try {
          const b = await photos.panel(ctx, input.before, { w: 600, h: 750, label: 'before photo' });
          const a = await photos.panel(ctx, input.after, { w: 600, h: 750, label: 'after photo' });
          collage = await sideBySide(ctx, b.data, a.data);
        } catch {
          collage = null;
        }
      }
      const deal = t.deal || card.deal || 'Full price';
      const disclosure =
        deal === 'Founding or early price'
          ? `${share === 'named' && first ? first : 'This customer'} was one of my first clients and paid a founding price, in return for permission to share photos and honest feedback.`
          : deal === 'Free sample'
            ? `This was a free sample: ${share === 'named' && first ? first : 'the customer'} did not pay for this job.`
            : '';
      const pal = print.paletteFor(cfg, input.color);
      const title = `${t.what}${area ? ` in ${area}` : ''}`;
      const html = pages.caseStudy(cfg, {
        business: f.business,
        first: f.first,
        phone: f.phone,
        link: f.link,
        area: area ? `${N.name} in ${area}` : N.name,
        title,
        sub: time.longDate(time.today(ctx)),
        collage,
        alt: `Before and after: ${t.what}`,
        place: share === 'named' ? area : '',
        did: [],
        result: [t.result, t.took ? `Done in ${t.took.replace(/^in\s+/i, '')}.` : ''].filter(Boolean).join(' ').replace(/([^.])\s*Done/, '$1. Done'),
        quote: t.quote,
        who,
        disclosure,
        cta: `${f.phone ? `Call or text ${f.phone}` : 'Message me'} for a ${N.job || 'job'} like this one. ${N.offer.promise}`,
      }, pal);
      const asset = await save.saveFile(ctx, save.fileName(f.business, 'case study', '.html'), html);
      const post = text.plain([`${title}.`, t.result ? `${t.result.replace(/\.$/, '')}.` : '', t.quote ? `"${t.quote}" (${who}).` : '', disclosure, f.phone ? `Text ${f.phone} to book.` : ''].filter(Boolean).join(' '));
      return { title, disclosure, post, files: { html: asset } };
    },
    view(out) {
      return views.blocks(
        views.file(out.files.html, 'Case study: one page for your site, your Google profile or a partner'),
        views.copy('Short version for a post', out.post),
        out.disclosure ? views.text(`The note "${out.disclosure}" stays on every copy: a discount or free job is a connection buyers should know about.`) : null,
      );
    },
  };
}

// Two square photos side by side as one JPEG for the case study page.
async function sideBySide(ctx, left, right) {
  const fs = require('fs');
  const path = require('path');
  const dir = media.scratch(ctx, 'case');
  const a = path.join(dir, 'a.jpg');
  const b = path.join(dir, 'b.jpg');
  const out = path.join(dir, 'ab.jpg');
  fs.writeFileSync(a, left);
  fs.writeFileSync(b, right);
  await media.ffmpeg(['-i', a, '-i', b, '-filter_complex', '[0:v]pad=iw+16:ih:0:0:white[l];[l][1:v]hstack=inputs=2', '-frames:v', '1', '-q:v', '4', out], { timeoutSec: 60, signal: ctx.signal });
  return fs.readFileSync(out);
}

module.exports = { cardTool, caseTool, resultSvg, collageSvg, typedFacts, dealOf, DEALS };
