// One long piece into many. content.key_points reads the piece (pasted, or the member's own page)
// and pulls out its points; content.repurpose turns the points the member picked into a carousel,
// three short video scripts, posts for Instagram, Facebook, LinkedIn, Threads and X, a newsletter
// email and quote cards, with a week to post them in.

const fs = require('fs');
const path = require('path');
const { text, ai, views, save, files, media, time, web } = require('../../_kit');
const { factsOf, signature } = require('../lib/facts');
const { fromPlain } = require('../lib/carousel');
const { slidesSvg, slideSvg, contactSheet } = require('../lib/design');
const { hashtags } = require('../lib/scripts');
const R = require('../lib/repurpose');
const { page, table, esc } = require('../lib/page');
const { FACT_INPUTS } = require('./hooks');

const SAMPLE = path.join(__dirname, '..', 'sample', 'long-piece.txt');
const isSampleHost = (u) => /\.example(\/|$|:)/i.test(String(u || '').replace(/^https?:\/\//, ''));
const noEnd = (s) => String(s || '').trim().replace(/[.?!:;,]+$/, '');
const okLine = (s) => !!s && text.copyProblems(s).length === 0;

const POINTS_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', maxLength: 90 },
    summary: { type: 'string', maxLength: 260 },
    points: { type: 'array', minItems: 3, maxItems: 8, items: { type: 'object', properties: { title: { type: 'string', maxLength: 80 }, body: { type: 'string', maxLength: 240 } }, required: ['title', 'body'] } },
    quotes: { type: 'array', maxItems: 3, items: { type: 'string', maxLength: 160 } },
  },
  required: ['title', 'summary', 'points'],
};

const keyPoints = {
  name: 'content.key_points',
  title: 'Find the key points',
  description: 'Reads one long piece of yours (a blog post, newsletter, talk or video transcript, pasted or from your own page) and pulls out its title, a short summary, 3 to 8 key points in your own words and up to 3 lines that work as quotes. Nothing is added that the piece does not say.',
  kind: 'ai',
  tasks: ['write'],
  risk: 'read',
  needs: [],
  credits: 3,
  timeoutSec: 90,
  input: {
    type: 'object',
    properties: {
      text: { type: 'string', format: 'textarea', title: 'Your long piece', description: 'Paste a blog post, newsletter, talk notes or a video transcript', maxLength: 30000 },
      url: { type: 'string', title: 'Or the address of your own blog post', description: 'We read the article text on the page', maxLength: 300 },
      title: { type: 'string', title: 'Title (optional)', maxLength: 120 },
    },
  },
  output: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      summary: { type: 'string' },
      points: { type: 'array' },
      quotes: { type: 'array' },
      source: { type: 'object' },
      ai: { type: 'boolean' },
      sample: { type: 'boolean' },
    },
    required: ['title', 'points', 'source'],
  },
  async run(input, ctx) {
    let raw = String(input.text || '').trim();
    let source = { kind: 'pasted', url: '' };
    const url = web.normalizeUrl(input.url || '');
    if (!raw && url && !isSampleHost(url)) {
      const r = await web.fetchPage(ctx, url, { timeoutMs: 15000 });
      if (!r.html) {
        const why = r.blocked ? 'the site asks bots not to read it' : r.status ? `the page answered ${r.status}` : r.notHtml ? "it isn't a web page" : "we couldn't reach it";
        throw new Error(`We couldn't read that page (${why}). Paste the text of your post instead.`);
      }
      raw = R.articleText(r.html);
      source = { kind: 'page', url: r.url || url };
      if (raw.split(/\s+/).length < 80) throw new Error('We found under 80 words of article text on that page. Paste the text of your post instead.');
    }
    if (!raw) {
      raw = fs.readFileSync(SAMPLE, 'utf8');
      source = { kind: 'sample', url: '' };
    }
    const wordsIn = raw.split(/\s+/).filter(Boolean).length;
    if (wordsIn < 60) throw new Error(`That is ${wordsIn} words. Paste a longer piece (a blog post, a newsletter or a video transcript) so there is enough to work with.`);
    const base = R.keyPoints(raw, { title: input.title });
    const srcWords = new Set(R.contentWords(raw));
    const { data, ai: usedAi } = await ai.aiJson(ctx, {
      task: 'write',
      system: 'You pull the key points out of a small business owner\'s own article so they can post them. Use only what the article says: no new facts, numbers, claims or examples. Keep their words where you can. Plain text, no markdown, no emoji.',
      prompt: [
        input.title ? `Title: ${input.title}` : '',
        'Return: title (under 80 characters), summary (1 or 2 sentences), 3 to 8 points in the order they appear (title: a short, punchy line under 70 characters; body: 1 or 2 sentences from the article that back it up), and up to 3 quotes copied word for word from the article that work on their own.',
        'Article:',
        raw.slice(0, 14000),
      ].filter(Boolean).join('\n'),
      schema: POINTS_SCHEMA,
      maxTokens: 2500,
      fallback: () => base,
      accept: (d) => ai.cleanCopy(d) && d.points.length >= 3 && d.points.every((p) => R.grounded(p, srcWords)),
    });
    const points = (data.points || [])
      .map((p) => ({ title: noEnd(R.clean(p.title)), body: R.clean(p.body) }))
      .filter((p) => p.title && okLine(p.title) && okLine(p.body))
      .slice(0, 8)
      .map((p, i) => ({ id: `p${i + 1}`, ...p }));
    if (!points.length) throw new Error("We couldn't find clear points in that piece. Try a piece with headings or short paragraphs.");
    const aiQuotes = usedAi ? (data.quotes || []).map(R.clean).filter((q) => okLine(q) && q.length <= 160 && R.verbatim(q, raw)) : [];
    const quotes = aiQuotes.length >= 2 ? aiQuotes.slice(0, 3) : base.quotes;
    const title = R.clean(input.title) || R.clean(data.title) || base.title;
    ctx.log(`${points.length} points and ${text.plural(quotes.length, 'quote')} from ${wordsIn} words${usedAi ? '' : ' (found in code)'}.`);
    return { title, summary: R.clean(data.summary) || base.summary, points, quotes, source: { ...source, words: wordsIn }, ai: usedAi, sample: source.kind === 'sample' };
  },
  view(out) {
    return views.blocks(
      out.sample ? views.text('This used a sample article for a made-up business. Paste your own piece to repurpose it.') : null,
      views.metric('Key points', out.points.length, `From ${out.source.words} words${out.source.url ? ` on ${web.domainOf(out.source.url)}` : ''}`),
      views.table([{ key: 'title', label: 'Point' }, { key: 'body', label: 'What backs it up' }], out.points)
    );
  },
};

const repurpose = {
  name: 'content.repurpose',
  title: 'Turn the points into posts',
  description: 'Turns the points you picked into a designed carousel (PNG slides in a ZIP and a preview), quote cards, 3 short video scripts, posts for Instagram, Facebook, LinkedIn, Threads and X with every limit counted, a newsletter email and a week to post them in.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  wants: ['render'],
  lane: 'render',
  timeoutSec: 300,
  credits: 8,
  input: {
    type: 'object',
    properties: {
      points: { type: 'array', description: 'The points to use, from content.key_points' },
      title: { type: 'string', maxLength: 120 },
      summary: { type: 'string', maxLength: 400 },
      quotes: { type: 'array' },
      source: { type: 'object' },
      ...FACT_INPUTS,
    },
    required: ['points'],
  },
  output: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      slides: { type: 'integer' },
      caption: { type: 'string' },
      posts: { type: 'object' },
      scripts: { type: 'array' },
      email: { type: 'object' },
      quotes: { type: 'array' },
      week: { type: 'array' },
      checks: { type: 'array' },
      zip: { type: 'object' },
      sheet: { type: ['object', 'null'] },
      page: { type: 'object' },
      rendered: { type: 'boolean' },
      sample: { type: 'boolean' },
    },
    required: ['title', 'posts', 'zip', 'page'],
  },
  async run(input, ctx) {
    const f = factsOf(ctx, input);
    const points = (Array.isArray(input.points) ? input.points : []).filter((p) => p && p.title).slice(0, 7).map((p) => ({ title: noEnd(R.clean(p.title)), body: R.clean(p.body || '') }));
    if (!points.length) throw new Error('Pick at least one point to turn into posts.');
    const src = input.source && typeof input.source === 'object' ? input.source : {};
    const url = src.kind === 'page' && /^https:\/\//.test(src.url || '') ? src.url : '';
    const piece = { title: R.clean(input.title) || points[0].title, summary: R.clean(input.summary) || points[0].body || '' };
    const today = time.today(ctx);

    // Carousel and quote cards.
    const car = fromPlain(f, { title: piece.title, slides: points.map((p) => ({ title: p.title, body: R.sentences(p.body).slice(0, 2).join(' ') })) });
    const sig = signature(f);
    const slideSvgs = slidesSvg(car.slides, { palette: f.palette, theme: 'bold', signature: sig });
    const quotes = (Array.isArray(input.quotes) ? input.quotes : []).map(R.clean).filter(okLine).slice(0, 3);
    const by = [f.first, f.name].filter(Boolean).join(', ');
    const quoteSvgs = quotes.map((q) => slideSvg({ kind: 'statement', title: `"${noEnd(q)}."`, body: by }, { palette: f.palette, theme: 'bold', index: 0, total: 1, signature: sig }));
    const base = save.fileName(f.fileBase, text.clip(piece.title, 40).replace(/\.\.\.$/, '')).replace(/\.[a-z]+$/, '');
    let zip = null;
    let sheet = null;
    let rendered = false;
    const entries = [...slideSvgs.map((s, i) => ({ name: `slide-${String(i + 1).padStart(2, '0')}`, svg: s })), ...quoteSvgs.map((s, i) => ({ name: `quote-${i + 1}`, svg: s }))];
    if (media.canRender(ctx)) {
      try {
        const pngs = [];
        for (const e of entries) pngs.push({ name: `${e.name}.png`, data: await media.svgToPng(ctx, e.svg) });
        zip = await save.saveFile(ctx, `${base}-slides.zip`, files.zip(pngs), 'application/zip');
        sheet = await save.saveFile(ctx, `${base}-preview.png`, await media.svgToPng(ctx, contactSheet(entries.map((e) => e.svg), { palette: f.palette, title: text.clip(piece.title, 48) })), 'image/png');
        rendered = true;
      } catch (e) {
        if (/^Stopped\.?$/.test(String(e && e.message))) throw e;
        ctx.log(`Rendering stopped (${text.clip(String(e && e.message), 80)}), so the slides come as SVG files instead.`);
      }
    }
    if (!rendered) zip = await save.saveFile(ctx, `${base}-slides-svg.zip`, files.zip(entries.map((e) => ({ name: `${e.name}.svg`, data: e.svg }))), 'application/zip');

    // Words for every place.
    const posts = { instagram: car.caption, ...R.posts(f, piece, points, { url }) };
    const scripts = R.scriptPoints(points).map((p) => R.scriptFor(f, p, { url, piece, tags: hashtags(f) }));
    const email = R.newsletter(f, piece, points, { url });
    const tags = hashtags(f).join(' ');
    const quoteOut = quotes.map((q, i) => ({ n: i + 1, text: q, caption: text.plain(`${q}\n\nFrom my post: ${noEnd(piece.title)}.\n\n${f.ctaLine}\n\n${tags}`) }));
    const L = R.LIMITS;
    const checks = [
      { where: 'Instagram caption', length: posts.instagram.length, max: L.instagram },
      { where: 'LinkedIn post', length: posts.linkedin.length, max: L.linkedin },
      ...posts.threads.map((t, i) => ({ where: `Threads post ${i + 1}`, length: t.length, max: L.threads })),
      { where: 'X post (links count as 23)', length: R.xLength(posts.x), max: L.x },
      ...scripts.map((s, i) => ({ where: `Video ${i + 1} caption`, length: s.caption.length, max: L.instagram })),
    ].map((c) => ({ ...c, ok: c.length > 0 && c.length <= c.max }));
    const bad = checks.find((c) => !c.ok);
    if (bad) throw new Error(`${bad.where} came out at ${bad.length} characters (the limit is ${bad.max}). Pick fewer points and run it again.`);
    const wk = R.week(time.addDays(today, 1), { scripts: scripts.length, quotes: quoteOut.length, addDays: time.addDays }).map((d) => ({ ...d, day: time.shortDate(d.date) }));

    // The page with everything.
    const pre = (s) => `<pre>${esc(s)}</pre>`;
    const lim = (c) => (c ? `<p class="muted">${c.length.toLocaleString('en-US')} of ${c.max.toLocaleString('en-US')} characters.</p>` : '');
    const checkFor = (where) => checks.find((c) => c.where === where);
    const scriptCard = (s, i) => `<div class="card"><div class="meta"><span class="tag">Video ${i + 1}</span><span class="tag">About ${s.seconds} seconds</span></div><h3>${esc(s.title)}</h3>${table([{ key: 'part', label: 'Part' }, { key: 'say', label: 'Say' }, { key: 'onScreen', label: 'On screen' }, { key: 'shot', label: 'Film' }], [
      { part: 'Hook', ...s.hook },
      ...(s.intro ? [{ part: 'Who you are', ...s.intro }] : []),
      ...s.beats.map((b, j) => ({ part: `Point ${j + 1}`, ...b })),
      { part: 'Close', ...s.close },
    ])}<p class="muted">Caption</p>${pre(s.caption)}</div>`;
    const preview = rendered ? '' : `<div class="card"><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px">${entries.map((e) => e.svg.replace(/^<\?xml[^>]*>/, '').replace('<svg ', '<svg style="width:100%;height:auto;border-radius:10px" ')).join('')}</div></div>`;
    const body = `<section><h2>Your week from this post</h2><p class="lead">One piece, posted seven ways. Start tomorrow, or move the days to fit your week.${quoteOut.length > 1 ? ` Keep the other quote cards for the week after.` : ''}</p>${table([{ key: 'day', label: 'Day' }, { key: 'what', label: 'Post' }], wk)}</section>
<section><h2>The carousel</h2><p class="lead">${esc(text.plural(car.slides.length, 'slide'))} at 1080x1350${quoteOut.length ? ` and ${esc(text.plural(quoteOut.length, 'quote card'))}` : ''}, ${rendered ? 'in the ZIP file in order, ready to post' : 'as SVG files in the ZIP: open them in Canva or Figma to export, or run this again where images can be made'}. Post the slides as one carousel.</p>${preview}<div class="card"><h3>Instagram caption</h3>${pre(posts.instagram)}${lim(checkFor('Instagram caption'))}</div></section>
<section><h2>Three short videos</h2><p class="lead">Film vertical, say the hook in the first second, and put the on-screen text in the middle of the frame.</p>${scripts.map(scriptCard).join('')}</section>
<section><h2>Posts for every app</h2>
<div class="card"><h3>LinkedIn</h3>${pre(posts.linkedin)}${lim(checkFor('LinkedIn post'))}</div>
<div class="card"><h3>Facebook</h3>${pre(posts.facebook)}</div>
<div class="card"><h3>Threads, as ${esc(text.plural(posts.threads.length, 'post'))} in a row</h3>${posts.threads.map((t, i) => `${pre(t)}${lim(checkFor(`Threads post ${i + 1}`))}`).join('')}</div>
<div class="card"><h3>X</h3>${pre(posts.x)}${lim(checkFor('X post (links count as 23)'))}</div></section>
<section><h2>The newsletter</h2><div class="card"><h3>Subject line, pick one</h3><ul>${email.subjects.map((s) => `<li>${esc(s)}</li>`).join('')}</ul><p class="muted">Preview text: ${esc(email.preview)}</p>${pre(email.body)}<p class="muted">Send it from your email tool, only to people who signed up. Put your business address where it says so; your email tool adds the unsubscribe link.</p></div></section>
${quoteOut.length ? `<section><h2>Quote cards</h2>${quoteOut.map((q) => `<div class="card"><span class="tag">quote-${q.n}.${rendered ? 'png' : 'svg'}</span><h3>"${esc(noEnd(q.text))}."</h3>${pre(q.caption)}</div>`).join('')}</section>` : ''}`;
    const html = page(f, {
      title: piece.title,
      kicker: src.kind === 'sample' ? 'Sample article' : 'Repurposed',
      sub: `${text.plural(points.length, 'point')} from your post, made into a carousel, ${text.plural(scripts.length, 'video script')}, posts for 5 apps and a newsletter.`,
      stats: [{ value: car.slides.length, label: 'carousel slides' }, { value: scripts.length, label: 'video scripts' }, { value: 5, label: 'apps with a post' }, { value: quoteOut.length, label: 'quote cards' }],
      body,
      foot: `${[f.name, f.where].filter(Boolean).join(', ')}. Every line comes from your post. Limits checked on the apps' help pages on Oct 19, 2026.`,
    });
    const pageFile = await save.saveFile(ctx, `${base}-posts.html`, html);
    ctx.log(`${car.slides.length} slides, ${quoteOut.length} quote cards, ${scripts.length} scripts, 5 posts and an email${rendered ? '' : ' (slides as SVG)'}.`);
    return {
      title: piece.title,
      slides: car.slides.length,
      caption: posts.instagram,
      posts,
      scripts: scripts.map((s) => ({ title: s.title, seconds: s.seconds, hook: s.hook.say, spoken: s.spoken, caption: s.caption })),
      email,
      quotes: quoteOut,
      week: wk,
      checks,
      zip,
      sheet,
      page: pageFile,
      rendered,
      sample: src.kind === 'sample',
    };
  },
  view(out) {
    return views.blocks(
      out.sample ? views.text('Made from a sample article for a made-up business. Paste your own piece to get yours.') : null,
      out.sheet ? views.image(out.sheet, `${out.slides} carousel slides${out.quotes.length ? ` and ${out.quotes.length} quote cards` : ''}`) : views.text(`${out.slides} carousel slides, saved as SVG files you can open in Canva or Figma.`),
      views.file(out.zip, out.rendered ? 'All slides and quote cards (PNG, in a ZIP)' : 'All slides and quote cards (SVG, in a ZIP)'),
      views.file(out.page, 'Everything on one page: scripts, posts, email and your week'),
      views.table([{ key: 'day', label: 'Day' }, { key: 'what', label: 'Post' }], out.week),
      views.copy('Instagram caption', out.posts.instagram),
      views.copy('LinkedIn post', out.posts.linkedin),
      views.copy('Facebook post', out.posts.facebook),
      out.posts.threads.map((t, i) => views.copy(`Threads post ${i + 1} of ${out.posts.threads.length}`, t)),
      views.copy('X post', out.posts.x),
      views.copy('Newsletter email', out.email.body, { subject: out.email.subjects[0] }),
      out.scripts.map((s, i) => views.copy(`Video ${i + 1}: ${s.title} (about ${s.seconds} seconds)`, s.spoken))
    );
  },
};

module.exports = { keyPoints, repurpose };
