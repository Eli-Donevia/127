// Front doors (Funnels v2, W8 in v2/turnkey/BUILD-PLAN.md): the "What are you building?" picker on / and /start,
// and the four new free tools behind it. Each door runs one of HQ's own free workflows for a visitor and ends with
// Free and Builder side by side. First 25 is the local service door and keeps its own page.
// The server (lib/doors.js) and the pages (door.js, views/partials/doors.ejs) read this file, so the picker, the page
// and the result email say the same thing. Copy rules: Legal L62 (no plan gets anyone clients, leads or brands), no
// income or results claims, plain words. Builder lists name HQ workflows by id; their titles come from the packs.
// Legal cleared the doors with G1 to G7 (legal/handoffs/turnkey.md, row 11). Lines marked G or "part 5" are Legal's
// words: change their meaning only with Legal's OK.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DOORS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  return {
    picker: {
      label: 'Free, before you pay anything',
      heading: 'What are you building?',
      sub: 'Pick one. 127 does the first piece of work for your business right now, and you keep it.',
      roadmap: 'Not sure yet? Answer a few questions and get a 30-day roadmap.',
      doors: [
        { id: 'local', label: 'Local service', for: 'Cleaning, detailing, fitness, photos, repairs, anything you sell nearby.', result: '25 local businesses that could use what you sell, what each one is missing and the message to send each one.', href: '/first-25', cta: 'Find my first 25' },
        { id: 'store', label: 'Online store', for: 'A Shopify store, live or almost.', result: 'A full audit of your store, plus your product page rebuilt with the fixes.', href: '/store-audit', cta: 'Audit my store' },
        { id: 'creator', label: 'Creator or UGC', for: 'Short videos for brands.', result: '25 brands that fit what you film, a product to film for each, plus a sample clip brief.', href: '/brand-list', cta: 'Find my brands' },
        { id: 'site', label: 'Own idea or website', for: 'An idea, a side project, a business with no site yet.', result: 'Your landing page, built tonight, as a ZIP ready to publish free.', href: '/site-tonight', cta: 'Build my page' },
        { id: 'offer', label: 'Coaching or digital product', for: 'Sessions, programs, templates, courses.', result: 'Your offer scored out of 100 with the 3 fixes, plus a freebie built and ready to post.', href: '/offer-score', cta: 'Score my offer' },
      ],
    },

    // Shared lines on every door page.
    copy: {
      running: 'Working on it',
      again: 'Start over',
      // G1: a result nobody brings into HQ is deleted after 30 days.
      saved: 'Saved for {days} days at this link, then deleted, unless you bring it into 127 HQ.',
      sample: 'Sample data, made up to show how it works. Run it on your own details for the real thing.',
      capped: 'Live reads are at their limit for today, so this ran on a sample. Come back tomorrow to run it on yours.',
      failed: "That didn't work this time. Try again in a minute.",
      limit: "You've run this a few times today. Come back tomorrow, or open the result we emailed you.",
      freeLabel: 'Free',
      builderLabel: 'Builder adds, in 127 HQ',
      builderNote: 'Every send, post or charge waits for your OK.',
      nextLabel: 'Free and Builder',
      nextHeading: "What's free, and what Builder adds.",
      hq: { label: '127 HQ', heading: "It's waiting in your HQ.", body: 'Start free and this result is saved in 127 HQ, where the next step for your business is one tap.', start: 'Start free', signin: 'Have an account? Bring it in', freeLine: 'Saved in your free 127 HQ, ready for the next step' },
      files: 'Your files',
      fileOpen: 'Open',
      fileGet: 'Download',
      expired: 'This result has expired. Run it again for a fresh one.',
    },

    doors: {
      store: {
        path: '/store-audit',
        source: 'store-audit',
        keyword: 'AUDIT',
        track: 'Store Audit Run',
        title: 'Store audit · 127',
        description: 'Paste your Shopify store. Get a score out of 100, every fix ranked, and your product page rebuilt with the fixes. Free.',
        chip: 'Free · Full audit with your email',
        h1: 'Your store, audited. Your product page, rebuilt.',
        lede: 'Paste your store. 127 reads it the way a shopper sees it, checks it from photos to shipping, ranks every fix and mocks up your product page with the fixes applied.',
        fields: [
          { name: 'store', label: 'Your store', placeholder: 'yourstore.com', required: true, max: 300, auto: 'url' },
          // G3: ticked by the visitor before every run, never ticked for them (a sample store needs no tick).
          { name: 'owner', type: 'checkbox', label: 'I own or run this store.', required: true },
        ],
        sample: { label: 'No store yet? Try a sample store', values: { store: 'birchandbloom.example' } },
        // Part 5, under the button.
        note: 'Shopify stores only. We read your store\'s public pages once. The mock-up is just for you.',
        ownerError: 'Tick the box to confirm you own or run this store.',
        button: 'Audit my store',
        scan: 'Auditing {store}',
        progress: ['Reading your store', 'Scoring your store', 'Rebuilding your product page', 'Saving your report'],
        gate: { label: 'Get the full audit and your page mock-up.', line: 'Every fix with what we saw, your product page rebuilt with the fixes, and a product by product sheet.', button: 'Send my audit', sticky: 'Get the full audit and your page mock-up by email.' },
        free: ['A score out of 100, from photos to shipping', 'Every fix, ranked, with what we saw', 'Your product page rebuilt with the fixes', 'A product by product sheet of what to fix'],
        builder: ['shop.theme_sections', 'shop.compare_stores', 'shop.price_products', 'shop.launch_emails', 'shop.product_drop'],
        result: { heading: 'Your store scored {score} out of 100.', fixes: 'Your top fixes', more: '{n} more fixes in the full audit', strengths: 'Already working', mock: 'Your product page, rebuilt', mockTag: 'Mock-up', mockLine: 'A mock-up of {product} with the fixes applied, from your own photos and words, with numbered notes. It\'s just for you, and 127 never publishes it.', photos: 'photos per product', words: 'words in a typical description', high: 'High impact', minutes: 'About {n} min' },
        // A store the audit can't read (shop.audit's statuses).
        fail: { bad_url: "That isn't a store address", not_shopify: "This store isn't on Shopify", password: 'This store is behind a password', unreachable: "We couldn't reach this store", blocked: 'This store asks bots not to read it', other: "We couldn't audit this store", shopifyOnly: 'This audit reads Shopify stores only, because it uses the product feed every Shopify store publishes.', again: 'Try another store' },
        email: { subject: 'Your store audit: {score} out of 100', open: 'Open your audit, the page mock-up and the product sheet' },
        files: { report: 'The full audit (opens in a browser, prints to PDF)', mock: 'Mock-up of your product page, rebuilt', issues: 'Product by product sheet (.csv)' },
      },
      creator: {
        path: '/brand-list',
        source: 'brand-list',
        keyword: 'BRANDS',
        track: 'Brand List Run',
        title: 'Brand list · 127',
        description: 'Pick what you film. Get 25 small brands that fit, a product to film for each, what their content is missing, the first message to send, and a sample clip brief. Free.',
        chip: 'Top 5 free · All 25 with your email',
        h1: '25 brands that fit what you film.',
        lede: 'Pick what you film. 127 picks 25 small brands that sell it, a product to film for each, what their store\'s content is missing, and writes the first message and a sample clip brief.',
        fields: [
          { name: 'category', label: 'What do you want to film?', type: 'select', options: 'categories', required: true },
          { name: 'name', label: 'Your first name (it goes in your messages)', placeholder: 'e.g. Maya', max: 40, auto: 'given-name' },
          { name: 'site', label: 'Portfolio link (optional)', placeholder: 'yourname.com or a TikTok link', max: 300 },
        ],
        note: 'Store facts come from each brand\'s own public store, read on the date we show.',
        button: 'Find my 25 brands',
        scan: 'Finding brands that fit what you film',
        progress: ['Matching brands to what you film', 'Picking a product to film for each', 'Writing your first messages', 'Writing your clip brief'],
        gate: { label: 'Get all 25, every message and your clip brief.', line: 'All 25 with a product to film, the first message and 2 follow-ups for each, a 15-second clip brief for #1, and a file for Sheets or Notion.', button: 'Send me my 25', sticky: 'Get all 25 brands and every message by email.' },
        free: ['25 brands that fit what you film', 'A product to film for each, and what its content is missing', 'The first message and 2 follow-ups for each', 'A 15-second clip brief for #1', 'A file for Sheets or Notion'],
        builder: ['ugc.offer', 'ugc.rates', 'ugc.pitch_one', 'ugc.reply', 'ugc.brief', 'ugc.portfolio'],
        result: { heading: '{n} {category} brands that fit what you film.', top: 'Your top 5', more: '{n} more in the full list', brief: 'Your clip brief for {brand}', read: 'Store facts from each brand\'s own public product feed, as read on {date}.', sources: 'Each name links to its store, and each product to its page.', film: 'Product to film:', widened: 'Your list ran short, so it adds the closest kinds of brands, each marked: {kinds}.', more2: 'The email and 2 follow-ups', msgs: { dm: 'DM', email: 'Email', follow1: 'Follow-up 1', follow2: 'Follow-up 2' }, shots: 'Shot list', notes: 'Before you film', disclose: 'If a brand pays you or sends free product, say so in the post (like #ad).', emailNote: 'Before you send an email, put your mailing address where it says [your mailing address] (a PO box works). If they say no, stop.' },
        email: { subject: 'Your 25 brands: {category}', open: 'Open all 25, every message and your clip brief' },
        files: { csv: 'All 25 with their messages (.csv)', brief: 'Clip brief and shot list (.md)' },
      },
      site: {
        path: '/site-tonight',
        source: 'site-tonight',
        keyword: 'SITE',
        track: 'Site Tonight Run',
        title: 'Site in a night · 127',
        description: 'Type your business or idea. Get a fast one-page website built from your words, as a ZIP you can publish free tonight. Free.',
        chip: 'Free · The ZIP with your email',
        h1: 'Your landing page, built tonight.',
        lede: 'Tell 127 what you\'re building. It picks the design that fits, writes the page from your words and hands you the whole site as a ZIP you drag onto free hosting tonight.',
        fields: [
          { name: 'business', label: 'Name of your business or idea', placeholder: 'e.g. Fern Hill Pottery', required: true, max: 80, auto: 'organization' },
          { name: 'what', label: 'What it does, in a few words', placeholder: 'e.g. Wheel-throwing classes for beginners', required: true, max: 120 },
          { name: 'services', label: 'What you offer (optional), one per line, with a price if you have one', type: 'textarea', placeholder: 'Intro class, $45\nDate night for two, $90', max: 1200 },
          { name: 'city', label: 'City (optional)', placeholder: 'e.g. Des Moines', max: 80, auto: 'address-level2' },
          { name: 'email', label: 'Email for your page (needed before it goes online)', placeholder: 'hello@yourbusiness.com', max: 120, auto: 'email' },
        ],
        sample: { label: 'Try it with a sample business', values: { business: 'Fern Hill Pottery', what: 'Wheel-throwing classes for beginners', services: 'Intro class, 2 hours, $45\nDate night for two, $90\n4-week course, $180', city: 'Des Moines' } },
        note: 'Only the words you type go on your page. Nothing is published until you put it online yourself.',
        button: 'Build my page',
        scan: 'Building the page for {business}',
        progress: ['Picking the design that fits', 'Writing your page', 'Building the files', 'Zipping it for free hosting'],
        gate: { label: 'Get your site as a ZIP, ready to publish.', line: 'The whole site folder, your share image spot, search tags and the free steps to put it online tonight.', button: 'Send my site', sticky: 'Get your site as a ZIP by email.' },
        // Legal D49: the email stays optional, and while the build lists what's missing nothing says the site is ready.
        gateAlmost: { label: 'Get your site as a ZIP, almost ready to put online.', line: 'The whole site folder, what to add before it goes online, and the free steps to put it online after.' },
        free: ['A one-page website built from your words', 'The design picked for your kind of business', 'The whole site as a ZIP for free hosting', 'Search tags, a thanks page and the steps to put it online'],
        builder: ['site.build_tonight', 'offer.grand_slam', 'offer.name_it', 'offer.price_it'],
        result: { heading: 'Your page is built.', design: 'Design: {design}, picked for {business}.', preview: 'Your page', photos: 'Photos to swap in', photosLine: 'Your page ships with placeholder art. Swap in your own photos at these sizes, with the same file names.', share: 'Share it', deploy: 'Put it online free tonight', deploySteps: ['Download the ZIP.', 'Open Netlify Drop and drag the ZIP onto it.', 'Sign up free to claim the site, then rename it so the address matches your business.'], yours: 'The site is yours to keep, change and host anywhere.', almost: 'Almost ready to put online', almostAgain: 'Build it again with these filled in before you put it online.', almostEmail: 'Your result page has a box to add it and build it again.', then: 'Then put it online free:', fix: { label: 'Email for your page', placeholder: 'hello@yourbusiness.com', button: 'Build it again', error: 'That email looks off. Check it and try again.' } },
        email: { subject: 'Your site for {business} is built', open: 'Open your site and download the ZIP' },
        files: { zip: 'Your website folder (ZIP) for free hosting', preview: 'Preview your page in a browser', share: 'Your share image' },
      },
      offer: {
        path: '/offer-score',
        source: 'offer-score',
        keyword: 'GRADE',
        track: 'Offer Score Run',
        title: 'Offer score · 127',
        description: 'Describe your coaching or digital product. Get it scored out of 100, the 3 fixes that raise it most, a rewrite, and a freebie built and ready to post. Free.',
        chip: 'Free · The rewrite and your freebie with your email',
        h1: 'Your offer, scored. Your freebie, built.',
        lede: 'Describe what you sell. 127 scores it out of 100 on what buyers weigh, gives you the 3 fixes that raise it most, rewrites it, and builds a freebie your buyers can use today.',
        fields: [
          { name: 'kind', label: 'What do you sell?', type: 'select', options: [['coaching', 'Coaching, sessions or a program'], ['digital', 'A digital product, template or course']], required: true },
          { name: 'what', label: 'What is it, in a few words?', placeholder: 'e.g. Strength coaching for new runners', required: true, max: 200 },
          { name: 'who', label: 'Who buys it?', placeholder: 'e.g. Runners training for their first half marathon', max: 200 },
          { name: 'outcome', label: 'What result do they want? (optional)', placeholder: 'e.g. Finish without knee pain', max: 200 },
          { name: 'price', label: 'Your price now (optional)', type: 'number', placeholder: 'e.g. 149', min: 0, max: 100000 },
          { name: 'offer', label: 'Your offer in your words (optional)', type: 'textarea', placeholder: 'What you would post or say today.', max: 2000 },
        ],
        sample: { label: 'Try it with a sample offer', values: { kind: 'coaching', what: 'Strength coaching for new runners', who: 'Runners training for their first half marathon', outcome: 'Finish without knee pain', price: '149' } },
        note: 'We score your words with code and only use the facts you give.',
        button: 'Score my offer',
        scan: 'Scoring your offer',
        progress: ['Scoring your offer', 'Finding the 3 fixes', 'Building your freebie', 'Writing the post to share it'],
        gate: { label: 'Get the rewrite and your freebie.', line: 'Your offer rewritten with the 3 fixes, the full score report, and your freebie as a file with the post and DM keyword to share it.', button: 'Send my offer', sticky: 'Get the rewrite and your freebie by email.' },
        free: ['Your offer scored out of 100 on what buyers weigh', 'The 3 fixes that raise it most', 'Your offer rewritten with them', 'A freebie built for your buyers, with the post and DM keyword to share it'],
        builder: ['offer.grand_slam', 'offer.price_it', 'offer.money_model', 'offer.promise', 'offer.name_it'],
        result: { heading: 'Your offer scored {score} out of 100.', reads: 'How clear and strong your offer reads today. It isn\'t a prediction of sales.', after: 'With the 3 fixes: {after} out of 100.', weigh: 'What buyers weigh', fixes: 'The 3 fixes', try: 'Try:', points: '+{n} points', rewrite: 'Your offer, rewritten', magnet: 'Your freebie: {title}', post: 'Post to share it', keyword: 'DM keyword: {keyword}', deliver: 'When someone sends the keyword, reply with' },
        email: { subject: 'Your offer score: {score} out of 100', open: 'Open your score, the rewrite and your freebie' },
        files: { report: 'Your offer score report', magnet: 'Your freebie' },
      },
    },

    // Every door's after-email block next to Free and Builder (results-kit.js R.block), like First 25's.
    // Paid-plan lines say what Builder has, never that it gets anyone clients, leads or brands (Legal L62).
    lines: {
      heading: 'Keep going in 127 HQ.',
      a1: 'Day 1 of the challenge, {day1}, is Pick one. Your result is a head start on it.',
      a2: 'On {doorsShort}, start free and bring this result into 127 HQ.',
      resource: 'You have the first piece of work. Builder adds the workflows for every next step in 127 HQ.',
      start: 'Start free. Your result is saved in 127 HQ, with the next step one tap away.',
      builder: 'Builder, ${builderPrice} a month: every Builder workflow in 127 HQ for your kind of business.',
    },
  };
});
