// First 25: what you sell, who buys it, the gaps we check for, and every line of copy the
// tool writes (messages, samples, the 7-day plan). Edit copy here; first25-engine.js uses it
// on the page and on the server, so the page, the CSV and the email always say the same thing.
//
// Rules for this file (brand/voice-and-messaging.md §5, §7, §15):
// - Messages are honest: the sender never claims past clients, results or experience.
// - Every observation says what we checked ("on your website"), never what we can't know.
// - The outcome we promise is a first conversation and a first client, never income.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FIRST25 = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  // ---------- who buys (local businesses) ----------
  // q: the search phrase ("gyms in Des Moines, IA"). type: Google Places includedType when one fits.
  // osm: OpenStreetMap tags for the free source. what: what they sell, for messages.
  // film: what a video or photo sample would show. chains: names we drop (corporate marketing, not a first client).
  // skip: words in an OpenStreetMap name that mean it isn't a business to pitch (an apartment building's gym).
  var buyers = {
    gyms: {
      label: 'Gyms and fitness studios', one: 'gym', many: 'gyms', q: 'gyms and fitness studios', type: 'gym',
      osm: ['leisure=fitness_centre', 'amenity=gym', 'sport=crossfit', 'amenity=dojo', 'leisure=sports_centre][sport~fitness|crossfit|boxing|kickboxing|martial_arts|mma|climbing|bouldering|weightlifting|powerlifting'], what: 'classes', film: 'a class', thing: 'class',
      chains: ['planet fitness', 'anytime fitness', 'la fitness', 'orangetheory', 'crunch fitness', '24 hour fitness', "gold's gym", 'golds gym', 'snap fitness', 'ymca', 'life time', 'lifetime fitness', 'equinox', '9round', 'retro fitness', 'blink fitness', 'chuze', 'eos fitness', 'genesis health', 'workout anytime', 'fitness 19', 'youfit', 'esporta', 'vasa fitness', 'f45', 'burn boot camp', 'koko fitclub', 'kosama', "farrell's", 'pure barre', 'club pilates', 'title boxing', 'ufc gym', 'cyclebar', 'rumble boxing', 'row house', 'stretchlab', 'hotworx', 'hot worx', 'jazzercise', 'fit body boot camp', 'camp gladiator', 'mayweather boxing', 'the exercise coach'],
      skip: ['apartments', 'apartment', 'residences', 'hotel', 'suites', 'university of', 'state university', 'college of', 'community college', 'high school', 'middle school', 'elementary', 'hospital', 'medical center', 'senior living', 'city of', 'recreation center', 'rec center', 'community center', 'aquatic center', 'aquatics'],
    },
    yoga: {
      label: 'Yoga and pilates studios', one: 'studio', many: 'yoga and pilates studios', q: 'yoga and pilates studios', type: 'yoga_studio',
      osm: ['sport=yoga', 'leisure=fitness_centre][sport=pilates'], what: 'classes', film: 'a class', thing: 'class',
      chains: ['corepower', 'club pilates', 'yogasix', 'pure barre', 'solidcore', 'hotworx', 'hot worx', 'stretchlab', 'bodybar'],
    },
    restaurants: {
      label: 'Restaurants and cafes', one: 'restaurant', many: 'restaurants', q: 'restaurants and cafes', type: 'restaurant',
      osm: ['amenity=restaurant', 'amenity=cafe'], what: 'food', film: 'a dish coming out of the kitchen', thing: 'dish',
      chains: ["mcdonald's", 'mcdonalds', 'starbucks', 'subway', 'chipotle', 'panera', 'taco bell', "wendy's", 'burger king', 'chick-fil-a', "domino's", 'pizza hut', 'dunkin', "applebee's", 'olive garden', "chili's", 'buffalo wild wings', "arby's", 'kfc', 'panda express', 'sonic', 'jimmy john', 'qdoba', "culver's", 'dairy queen', 'five guys', 'noodles & company', 'red robin', 'texas roadhouse', 'ihop', "denny's", 'perkins', 'jersey mike', 'firehouse subs', "casey's", 'kwik trip', 'kwik star', 'hy-vee', 'caribou coffee', 'dutch bros', "raising cane's", 'whataburger', 'popeyes', 'little caesars', "papa john's", "hardee's", 'cracker barrel', 'outback', 'red lobster', "godfather's", 'pizza ranch', 'runza', "freddy's frozen custard", "scooter's coffee", 'wingstop', "zaxby's", 'potbelly', 'crumbl', 'smoothie king', 'tropical smoothie', "jason's deli", "mcalister's", "fazoli's", "steak 'n shake", 'white castle'],
    },
    salons: {
      label: 'Salons and barbers', one: 'salon', many: 'salons and barbershops', q: 'hair salons and barbershops', type: 'hair_salon',
      osm: ['shop=hairdresser', 'shop=beauty'], what: 'work', film: 'a cut coming together', thing: 'cut',
      chains: ['great clips', 'supercuts', 'sport clips', 'fantastic sams', 'cost cutters', 'ulta', 'regis', 'hair cuttery', 'smartstyle', 'first choice haircutters', 'floyd', 'drybar', 'european wax', 'the lash lounge'],
    },
    medspas: {
      label: 'Med spas and skin clinics', one: 'med spa', many: 'med spas', q: 'med spas and skin clinics', type: null,
      osm: ['shop=beauty][beauty=skin_care', 'healthcare=clinic][healthcare:speciality=dermatology'], what: 'treatments', film: 'the space and a consult', thing: 'treatment',
      chains: ['ideal image', 'laseraway', 'milan laser', 'european wax center', 'hand & stone', 'massage envy', 'the joint', 'skin laundry', 'sono bello', 'body sculpt', 'alchemy 43', 'ever/body', 'face foundrie'],
    },
    dentists: {
      label: 'Dentists', one: 'dental office', many: 'dental offices', q: 'dentists', type: 'dentist',
      osm: ['amenity=dentist', 'healthcare=dentist'], what: 'care', film: 'the office and the team', thing: 'visit',
      chains: ['aspen dental', 'heartland dental', 'western dental', 'coast dental', 'gentle dental', 'smile brands', 'bright now', 'monarch dental', 'comfort dental', 'kool smiles', 'small smiles', 'castle dental', 'affordable dentures', 'clear choice', 'clearchoice'],
    },
    chiro: {
      label: 'Chiropractors and physical therapy', one: 'clinic', many: 'chiropractic and PT clinics', q: 'chiropractors and physical therapy clinics', type: 'chiropractor',
      osm: ['healthcare=chiropractor', 'healthcare=physiotherapist', 'amenity=chiropractor'], what: 'care', film: 'the clinic and a session', thing: 'session',
      chains: ['the joint', 'athletico', 'ati physical therapy', 'select physical therapy', 'upstream rehab', 'pivot physical therapy', 'professional physical therapy', 'confluent health', 'novacare', 'physiotherapy associates', 'benchmark physical therapy'],
    },
    realtors: {
      label: 'Real estate agents', one: 'agent', many: 'real estate agents', q: 'real estate agents', type: 'real_estate_agency',
      osm: ['office=estate_agent'], what: 'listings', film: 'a listing walkthrough', thing: 'listing', end: 'Book a showing.',
      chains: [],
    },
    contractors: {
      label: 'Home services (plumbing, HVAC, roofing)', one: 'company', many: 'home service companies', q: 'plumbing HVAC and roofing contractors', type: null,
      osm: ['craft=plumber', 'craft=hvac', 'craft=roofer', 'craft=electrician'], what: 'work', film: 'a job from start to finish', thing: 'job',
      chains: ['roto-rooter', 'mr. rooter', 'ars rescue', 'one hour heating', 'benjamin franklin plumbing', 'aire serv', 'mister sparky', 'servpro', 'servicemaster', 'mr. electric', 'home depot', "lowe's", 'sears home', 'leaf filter', 'leaffilter', 'rhino shield', 'window nation', 'renewal by andersen'],
    },
    auto: {
      label: 'Auto repair and detailing', one: 'shop', many: 'auto shops', q: 'auto repair and detailing shops', type: 'car_repair',
      osm: ['shop=car_repair', 'amenity=car_wash'], what: 'work', film: 'a car before and after', thing: 'job',
      chains: ['jiffy lube', 'midas', 'meineke', 'firestone', 'pep boys', 'valvoline', 'take 5', 'goodyear', 'monro', 'christian brothers automotive', 'maaco', 'discount tire', 'les schwab', 'ntb', 'caliber collision', 'gerber collision', 'safelite', 'grease monkey', 'tire kingdom', 'big o tires', 'mavis tire', 'brakes plus', 'tires plus', 'quick lane', 'mister car wash', 'tommy\'s express', 'autozone', "o'reilly", 'advance auto'],
    },
    boutiques: {
      label: 'Boutiques and local shops', one: 'shop', many: 'boutiques', q: 'boutiques and local gift shops', type: 'clothing_store',
      osm: ['shop=clothes', 'shop=boutique', 'shop=gift'], what: 'products', film: 'new arrivals on the rack', thing: 'piece',
      chains: ['target', 'walmart', 'tj maxx', 'marshalls', 'ross dress for less', 'old navy', 'h&m', 'zara', "kohl's", "macy's", 'nordstrom', 'banana republic', 'american eagle', 'hollister', 'ann taylor', 'francesca', 'altar\'d state', 'buckle', 'maurices', 'torrid', 'lane bryant', 'christopher & banks', 'hallmark', 'claire\'s', 'five below', 'hobby lobby', 'michaels', 'kirkland\'s', 'homegoods'],
    },
    law: {
      label: 'Law firms', one: 'firm', many: 'law firms', q: 'law firms', type: 'lawyer',
      osm: ['office=lawyer'], what: 'cases', film: 'the office and the team', thing: 'consult',
      chains: ['legalzoom', 'jacoby & meyers', 'morgan & morgan', 'h&r block', 'jackson hewitt', 'liberty tax'],
    },
  };

  // ---------- the gaps we check (from their website and their listing) ----------
  // why: the reason shown on the card. say: the line the message opens with (honest, about what we saw).
  // {biz} {city} {what} {year} {reviews} {thing} are filled per business.
  var gaps = {
    site_down: { chip: 'Site down', why: "Their website didn't load when we checked.", say: "I tried your website this week and it didn't load for me." },
    broken_link: { chip: 'Broken link', why: 'The website link on their map listing goes to a missing page.', say: "The website link on your map listing goes to a page that doesn't exist anymore." },
    // {page}: their Facebook page or Instagram when that's all they have instead of a website, else their map listing.
    no_site: { chip: 'No website', why: 'No website on their listing.', say: "I couldn't find a website for {biz}, just your {page}." },
    no_video: { chip: 'No video', why: 'No video anywhere on their homepage.', say: "I was on your website and couldn't find any video of your {what}." },
    no_tiktok: { chip: 'No TikTok', why: 'No TikTok linked from their site.', say: "I couldn't find {biz} on TikTok." },
    no_youtube: { chip: 'No YouTube', why: 'No YouTube linked from their site.', say: "I didn't see a YouTube channel for {biz}." },
    no_instagram: { chip: 'No Instagram link', why: "Their site doesn't link to an Instagram.", say: "Your website doesn't link to an Instagram." },
    no_facebook: { chip: 'No Facebook link', why: "Their site doesn't link to a Facebook page.", say: "Your website doesn't link to a Facebook page." },
    no_pixel: { chip: 'No ad pixel', why: 'No Meta pixel on their homepage. Ads use it to reach people who already visited.', say: "It looks like your website isn't set up to show ads to people who've already visited." },
    no_booking: { chip: 'No online booking', why: 'No way to book or order online on their homepage.', say: "I couldn't find a way to book online on your website." },
    no_chat: { chip: 'No chat', why: 'No chat on their homepage.', say: "I didn't see a chat on your website for quick questions." },
    no_form: { chip: 'No contact form', why: 'No contact form on their homepage.', say: "Your homepage doesn't have a contact form." },
    no_signup: { chip: 'No email list', why: 'No email signup anywhere on their homepage.', say: "I couldn't find a way to join your email list on your website." },
    stale_footer: { chip: '© {year}', why: 'Their footer still says © {year}.', say: 'The footer on your website still says © {year}.' },
    no_https: { chip: 'Not secure', why: 'Their site has no https, so Chrome marks it "Not secure".', say: 'Your website shows as "Not secure" in Chrome.' },
    no_mobile: { chip: 'Not phone-ready', why: "Their site isn't set up for phones.", say: "Your website doesn't seem to be set up for phones." },
    slow: { chip: 'Slow site', why: 'Their homepage took over 3 seconds to respond when we checked.', say: 'Your homepage took a few seconds to load for me.' },
    // Legal L53 part 3.4: the member didn't search, so the line says what the homepage is missing.
    no_description: { chip: 'No search description', why: 'Their homepage has no description set for search results.', say: "Your homepage doesn't have a description set for search results." },
    few_images: { chip: 'Few photos', why: 'Fewer than 6 photos on their homepage.', say: 'Your website only has a few photos of your {what}.' },
    // Google's numbers stay in the app, with the attribution, never in a message (Legal L53 part 3.4).
    few_reviews: { chip: '{reviews} reviews', why: '{reviews} Google reviews so far.', say: "I noticed {biz} doesn't have many Google reviews yet." },
  };

  // Signals that make a business a better first client (they already spend on marketing, they're busy).
  var fits = {
    ads: { why: 'Has an ad tag on their site, a sign they already pay for marketing.' },
    booking: { why: 'Takes bookings online, so more views can turn into bookings.' },
    busy: { why: '{reviews} Google reviews.' },
    rated: { why: '{rating} stars on Google from {reviews} reviews.' },
    independent: { why: 'Independent, not a chain. The owner decides.' },
  };

  // ---------- what you sell ----------
  // gaps: points for each gap this service fixes. fit: points for signs they'd buy.
  // verb: what you do, after "I". offer: the free sample, in the message. sample: the spec piece (see specs).
  var packs = {
    video: {
      label: 'Short videos', sell: 'short-form video', verb: 'make short videos', buyers: ['gyms', 'yoga', 'restaurants', 'salons', 'medspas', 'realtors'],
      gaps: { no_video: 30, no_tiktok: 16, no_instagram: 10, no_youtube: 5, no_site: 14, site_down: 8, few_reviews: 6, stale_footer: 5, few_images: 6 },
      fit: { ads: 10, booking: 6, busy: 6, independent: 4 },
      offer: "I'd like to make you one free 15-second reel from clips you already have.",
      walkin: 'Could I film 2 minutes of {film} this week and send you a free edit?',
      follow1: 'I went ahead and made the sample reel. Here it is: [paste your link]. If you like it, I can make 4 to 8 a month for you.',
      subject: 'A free reel for {biz}?',
      sample: 'video',
    },
    social: {
      label: 'Social media', sell: 'social media', verb: 'run social media', buyers: ['restaurants', 'boutiques', 'salons', 'gyms', 'yoga', 'medspas'],
      gaps: { no_instagram: 24, no_tiktok: 14, no_facebook: 8, no_pixel: 8, no_video: 10, no_site: 12, site_down: 6, few_reviews: 8, stale_footer: 6, few_images: 6 },
      fit: { ads: 8, busy: 8, booking: 4, independent: 4 },
      offer: "I'd like to write and design your next 3 posts for free, so you can see the style first.",
      walkin: 'Could I take a few photos this week and turn them into 3 free posts for you?',
      follow1: 'I made the 3 posts. Here they are: [paste your link]. Use them either way. If you want more like this every week, let me know.',
      subject: '3 free posts for {biz}?',
      sample: 'social',
    },
    web: {
      label: 'Websites', sell: 'a new website', verb: 'build websites', buyers: ['contractors', 'auto', 'salons', 'restaurants', 'law', 'dentists', 'chiro'],
      gaps: { no_site: 44, site_down: 38, broken_link: 24, no_https: 20, no_mobile: 20, stale_footer: 14, slow: 10, no_booking: 8, no_form: 8, no_description: 5 },
      fit: { busy: 10, rated: 4, independent: 4 },
      offer: "I'd like to make you a free mockup of a new homepage, and you keep it either way.",
      walkin: 'Could I send you a free mockup of a new homepage for {biz}? Takes me a day.',
      follow1: "I made the homepage mockup. Here it is: [paste your link]. If you'd like it live, I can have it up in a week.",
      subject: 'A free homepage mockup for {biz}',
      sample: 'web',
    },
    ai: {
      label: 'AI booking and follow-up', sell: 'AI booking and follow-up', verb: 'set up AI booking and follow-up', buyers: ['dentists', 'chiro', 'medspas', 'salons', 'contractors', 'law'],
      gaps: { no_booking: 30, no_chat: 16, few_reviews: 14, no_form: 10, no_site: 10, site_down: 6, slow: 4 },
      fit: { busy: 10, ads: 6, independent: 4 },
      offer: "I'd like to build you a free demo that answers booking questions for {biz}, so you can try it before you decide anything.",
      walkin: 'Could I build you a free demo that answers your booking questions, using what is already on your website?',
      follow1: 'I built the demo. Here it is answering real questions from your website: [paste your link]. Want me to set it up for real?',
      subject: 'A free booking demo for {biz}',
      sample: 'ai',
    },
    email: {
      label: 'Email marketing', sell: 'email marketing', verb: 'write email campaigns', buyers: ['boutiques', 'restaurants', 'gyms', 'yoga', 'salons', 'medspas'],
      gaps: { no_signup: 34, no_pixel: 8, no_site: 14, site_down: 6, few_reviews: 6, stale_footer: 6, no_instagram: 6 },
      fit: { busy: 10, ads: 8, booking: 4, independent: 4 },
      offer: "I'd like to write your first 3 emails for free, so you can see what it would look like.",
      walkin: 'Could I write your first 3 customer emails for free and show you how to send them?',
      follow1: 'I wrote the 3 emails. Here they are: [paste your link]. If you want, I can set up the signup form and send them for you.',
      subject: '3 free emails for {biz}?',
      sample: 'email',
    },
    photo: {
      label: 'Photography', sell: 'photography', verb: 'take photos', buyers: ['restaurants', 'realtors', 'boutiques', 'gyms', 'salons', 'medspas'],
      gaps: { few_images: 26, no_instagram: 14, no_site: 14, site_down: 6, few_reviews: 8, stale_footer: 8, no_video: 4 },
      fit: { busy: 10, rated: 4, ads: 6, independent: 4 },
      offer: "I'd like to shoot 3 free photos of your {what} so you can see the style.",
      walkin: 'Could I take 10 photos of your {what} this week and send you the best 3 for free?',
      follow1: 'Here are your 3 photos: [paste your link]. They are yours to use. If you want a full set every month, let me know.',
      subject: 'Free photos for {biz}?',
      sample: 'photo',
    },
    other: {
      label: 'Something else', sell: 'my service', verb: 'work with local businesses', buyers: ['restaurants', 'gyms', 'salons', 'contractors', 'auto', 'boutiques', 'dentists', 'realtors', 'law', 'medspas', 'yoga', 'chiro'],
      gaps: { no_site: 6, site_down: 4, broken_link: 4, stale_footer: 4, no_https: 3, no_mobile: 3 },
      fit: { busy: 26, rated: 14, independent: 16 },
      offer: "I'd like to show you my work with a free first job, so you can decide after.",
      walkin: 'Could I do a small first job for free so you can see the quality?',
      follow1: 'Following up on my note. The free first job is still on the table. Want me to pick a day?',
      subject: 'A free first job for {biz}?',
      sample: 'other',
    },
  };

  // ---------- the free sample to make before you message (top 3) ----------
  var hooks = {
    gyms: 'POV: your first class at {biz}', yoga: '60 minutes at {biz}, in 15 seconds', restaurants: 'The {thing} {city} keeps coming back for',
    salons: 'Watch this {thing} come together', medspas: 'What a visit to {biz} actually looks like', dentists: 'Meet the team at {biz}',
    chiro: 'What happens in your first session at {biz}', realtors: 'Inside this {city} listing in 15 seconds', contractors: 'One {thing}, start to finish',
    auto: 'Before and after, {biz}', boutiques: 'New at {biz} this week', law: 'Meet the team at {biz}',
  };
  var specs = {
    video: {
      title: 'Make one free reel for {biz}.',
      steps: [
        'Grab 4 to 6 clips from their public Instagram or Facebook. The edit is only for them, so never post it.',
        'Cut a 12 to 15 second vertical edit in CapCut: a hook in the first second, a cut on every beat, big captions.',
        'Open on this line: "{hook}".',
        'End on their name and one line: "{end}"',
        'Export at 1080x1920 and upload it as an unlisted link you can paste into your follow-up.',
      ],
      // Shot by shot, so the first edit takes an hour, not an evening.
      board: [
        ['0 to 2s', 'On screen: "{hook}"'],
        ['2 to 8s', 'Their 3 best clips, one cut on every beat'],
        ['8 to 12s', 'The moment people come for: {film}'],
        ['12 to 15s', 'Their logo and "{end}"'],
      ],
    },
    social: {
      title: 'Write and design 3 posts for {biz}.',
      steps: [
        'Scroll their last 9 posts. Note which ones got the most comments.',
        'Write 3 posts that do more of that: one behind the scenes, one customer favorite, one reason to come in this week.',
        "Design them in Canva in their colors, with their logo small in a corner. They're only for them, so never post them.",
        'Put the 3 images and the captions in one link you can paste into your follow-up.',
      ],
    },
    web: {
      title: 'Mock up a new homepage for {biz}.',
      steps: [
        'Screenshot their current homepage on your phone.',
        'Ask Claude to write a new homepage for {biz}: one headline, 3 short sections and one button that says "Book" or "Get a quote".',
        "Build the mockup in Framer, Canva or Lovable. Keep it to one screen on a phone. It's only for them, so never post it.",
        'Send the before and after side by side. People buy what they can see.',
      ],
    },
    ai: {
      title: 'Build a 2-minute booking demo for {biz}.',
      steps: [
        'Copy their hours, services, prices and FAQs from their website into a doc.',
        'Paste it into Claude and ask it to answer like their front desk. Test 10 real questions, like "Do you have anything Saturday?"',
        'Record a 60-second screen video of it answering 3 of them.',
        "Send the video, not a pitch. The demo does the selling. It's only for them, so never post it.",
      ],
    },
    email: {
      title: 'Write the first 3 emails for {biz}.',
      steps: [
        'Welcome: who they are and why people come back.',
        'Favorite: their best seller or most booked {thing}, with one photo.',
        'Come back: one reason to visit this month.',
        "Mock them up in a free email template and send screenshots, with the text ready to paste. They're only for them, so never post them.",
      ],
    },
    photo: {
      title: 'Shoot 10, send 3, for {biz}.',
      steps: [
        'Visit as a customer. Ask before you take a single photo.',
        'Shoot 10 photos of their best {what} in natural light, from their customers\' point of view.',
        "Edit the best 3 on your phone. Match the colors to their sign or logo.",
        'Send them with one line: "These are yours to use, free."',
      ],
    },
    other: {
      title: 'Do one small free job for {biz}.',
      steps: [
        'Pick the smallest piece of work that shows your quality in under an hour.',
        'Take a before photo and an after photo.',
        'Send both with one line: "This one is on me. Want me to do the rest?"',
      ],
    },
  };

  // ---------- the 7-day plan (first conversation, first client) ----------
  var plan = [
    'Make the free sample for #1. Send your message to #1 to #5.',
    'Send #6 to #10. Walk into the 2 closest and use the walk-in line. Skip any with a "No soliciting" sign.',
    'Follow up with #1 to #5, except anyone who said no. Send the sample you made.',
    'Send #11 to #15. Make a sample for the best reply so far.',
    'Follow up with #6 to #10, except anyone who said no. Ask anyone who replied for 15 minutes.',
    'Send #16 to #25.',
    'Last follow-ups, except anyone who said no. Write down every reply. That list is your next week.',
  ];

  // ---------- the tracker (the same stages as the HQ Pipeline, v2/harness/WORKFLOW-CONTRACT.md §7) ----------
  var stages = [
    { id: 'found', label: 'Not contacted', short: 'New' },
    { id: 'contacted', label: 'Sent', short: 'Sent' },
    { id: 'replied', label: 'Replied', short: 'Replied' },
    { id: 'call', label: 'Call booked', short: 'Call' },
    { id: 'won', label: 'Won', short: 'Won' },
    { id: 'lost', label: 'Not now', short: 'Not now' },
  ];

  // ---------- when they reply ----------
  // [brackets] are for the sender to fill in; the page highlights them so nobody sends one by mistake.
  var replies = [
    { id: 'yes', label: '"Sure, send it"', text: "Great, I'll have it to you by [day]. Is there anything you'd love me to show, or anything to avoid?" },
    { id: 'sent', label: 'Sending the sample', text: "Here it is: [paste your link]. If you like it, I can do this for {biz} every month. It's easier to show you than type it out. Do you have 10 minutes this week?" },
    { id: 'price', label: '"How much?"', text: "For {biz} I'd start simple: [what you'll do] each month for [your price]. No contract. If you'd like to see it first, the first one is free." },
    { id: 'who', label: '"Who are you?"', text: "I'm {me}. I {verb} for {many} in {city}. I'm starting with a few local businesses, so the first one is free. No catch." },
    { id: 'covered', label: '"We already have someone"', text: "Good to hear you're covered. If you ever want a second set of hands or a fresh idea, I'm around. Mind if I check back in a couple of months?" },
    { id: 'later', label: '"Not right now"', text: 'No problem at all. Can I check back in a couple of months? The free one is still yours whenever you want it.' },
    { id: 'quiet', label: 'Quiet after the sample', text: "Hi {biz} team, did the sample come through okay? Happy to change anything. If now's not the time, no worries at all." },
  ];

  // ---------- "Not sure what to sell?" (3 questions, then one pick) ----------
  var picker = {
    likes: [
      { id: 'film', label: 'Filming and editing' }, { id: 'write', label: 'Writing' }, { id: 'people', label: 'Talking to people' },
      { id: 'build', label: 'Building things on a computer' }, { id: 'photo', label: 'Taking photos' }, { id: 'ai', label: 'Trying new apps and AI' },
    ],
    // like: [what you sell, who to sell to if you'll walk in, who if you'd rather stay online]
    map: {
      film: ['video', 'gyms', 'realtors'], write: ['email', 'boutiques', 'yoga'], people: ['social', 'restaurants', 'salons'],
      build: ['web', 'contractors', 'dentists'], photo: ['photo', 'restaurants', 'boutiques'], ai: ['ai', 'medspas', 'dentists'],
    },
    why: {
      'video|gyms': 'Gyms post all the time, classes are easy to film, and the owner is usually on site.',
      'video|realtors': 'Agents need a video for every listing, and most of the work happens on your laptop.',
      'email|boutiques': 'Boutiques sell to people who already love them, and email is how they bring them back.',
      'email|yoga': 'Studios live on regulars, and a weekly email keeps the schedule full.',
      'social|restaurants': 'Restaurants need fresh posts every week, and you can shoot them while you eat.',
      'social|salons': 'Salons sell on looks, so a steady feed of their work brings in new bookings.',
      'web|contractors': 'People hire contractors from a Google search, so the website does the selling.',
      'web|dentists': 'New patients judge a dental office by its website before they ever call.',
      'photo|restaurants': 'Good food photos sell the dish, and you can shoot a menu in an afternoon.',
      'photo|boutiques': 'Every new arrival needs photos, and you can shoot a rack in an hour.',
      'ai|medspas': 'Med spas get the same booking questions every day, and a missed question is a missed booking.',
      'ai|dentists': 'Dental offices answer the same questions all day, and patients want answers after hours too.',
    },
    hours: [{ id: 'lt5', label: 'Under 5' }, { id: '5to15', label: '5 to 15' }, { id: '15', label: '15 or more' }],
    hoursNote: {
      lt5: 'With under 5 hours a week, aim for 1 client first.',
      '5to15': 'With 5 to 15 hours a week, 2 or 3 clients is plenty to start.',
      15: 'With 15 or more hours a week, you can work the whole list in 7 days.',
    },
  };

  // ---------- what you get (the form page) ----------
  var stack = [
    ['25 local businesses that could use what you sell', 'Ranked, with chains and closed ones taken out.'],
    ["What's missing on each one's website", 'In plain words, from a real check of their homepage.'],
    ['The message to send each one', 'A DM, an email, a walk-in line and 2 follow-ups.'],
    ['A mock-up for your #1', 'With their name on it, plus the steps to make the real one.'],
    ['Send mode and a tracker', 'Work your top 5 in one sitting, then track who replied.'],
  ];

  // ---------- the sample we make for them (after the email: #1, then any card on tap) ----------
  // kinds: the mockup each service gets. Per buyer: colors [background, text, accent], the words on the
  // mock homepage, their next 9 posts, the reel's 3 lines and one chat question.
  // Never invented facts about the business: no reviews, offers, prices, years or awards.
  // Only real facts are shown: the business's name and city, plus its rating, reviews, address and phone on
  // OpenStreetMap and sample lists. Google lists show only the name and city (Legal S24, L56).
  var mock = {
    kinds: { video: 'reel', social: 'grid', web: 'site', ai: 'chat', email: 'email', photo: 'shots' },
    titles: { reel: 'Their 15-second reel', grid: 'Their next 9 posts', site: 'Their new homepage', chat: 'Their website chat', email: 'Their first email', shots: 'The 9 photos to take' },
    surface: { reel: 'video', grid: 'Instagram', site: 'website', chat: 'chat', email: 'email', shots: 'photos' },
    notes: {
      // How to use it. Shown under the mock-up and in the email, so each one stands on its own.
      // Mock-ups stay private (Legal L53 part 3.5), and every screenshot keeps its "Not their real" line (L56).
      reel: "Make the real one from their clips with the steps below. It's only for them, so never post it.",
      grid: "Screenshot it with the \"Not their real Instagram\" line in view and send it with your message. It's only for them, so never post it.",
      site: "Screenshot it with the \"Not their real website\" line in view and send it with your message. Swap in their real photos once they say yes. It's only for them, so never post it.",
      chat: "Screenshot it with the \"Not their real chat\" line in view and send it with your message. It's only for them, so never post it.",
      email: "Screenshot it with the \"Not their real email\" line in view and send it with your message. It's only for them, so never post it.",
      shots: 'Ask {biz} before you shoot, then send them the best 3.',
    },
    // The line to send with the screenshot, in Legal's words (S24, L56). No name in it, so it works for every list.
    say: "I put together a quick mock-up of {what} for you, attached. It's just a mock-up, made only for you.",
    what: { grid: 'your next 9 posts', site: 'a new homepage', chat: 'a website chat', email: 'a welcome email' },
    sayLabel: 'Send it with this line',
    by: 'Sample by {me}',
    byNone: 'Sample',
    notReal: 'Not their real {surface}',
    make: 'Make their mock-up',
    // For the email gate: what #1's sample is, in a few words.
    short: { reel: 'a mock-up of a 15-second reel', grid: 'a mock-up of their next 9 posts', site: 'a mock-up of a new homepage', chat: 'a mock-up of a website chat', email: 'a mock-up of a welcome email', shots: 'a shot list' },
    chat: { hi: 'Hi, thanks for stopping by {biz}! Ask me anything, or I can book you in.', yes: 'Yes please', done: "Done. What's the best number to text the details to?", online: 'Online', type: 'Type a message' },
    email: {
      subject: 'Welcome to {biz}', pre: "Here's what to expect from us.",
      body: ['Thanks for joining the {biz} list.', "Once or twice a month we'll send what's new, the {ask} people ask about most, and the odd reason to stop by.", 'See you soon.'],
      sign: 'The {biz} team', foot: "You're getting this because you joined the {biz} list.",
    },
    shots: ['The front door', 'The space in morning light', 'Hands at work', 'The {thing} up close', 'The team, candid', "A customer's view", 'The details people miss', 'The busiest moment', 'The sign at dusk'],
    // When a buyer has no words of its own.
    base: { pal: ['#ffffff', '#1d1d1f', '#3a5bd9'], hero: 'Welcome to {biz}.', sub: 'Proudly local in {city}.', cta: 'Get in touch', ask: 'news',
      secs: [['What we do', 'A quick look at what {biz} offers.'], ['Visit', 'Find us in {city}.'], ['Contact', 'Call, email or stop by.']],
      grid: ['Meet the team', 'Behind the scenes', 'A customer favorite', 'How it works', 'This week', 'Your questions, answered', 'Inside the space', 'A local shout-out', 'Come say hi'],
      lines: ['Made in {city}', 'Made for you', 'Come see us'], q: 'Are you open today?', a: 'Let me check today for you. Want me to send you the hours?' },
    buyers: {
      gyms: { pal: ['#111111', '#ffffff', '#e4002b'], cta: 'Book your first class', hero: 'Stronger starts here.', sub: 'Classes and coaching in {city}, for every level.', ask: 'classes',
        secs: [['Classes', 'Find a time that fits and come try one.'], ['Coaching', 'Ask about training one on one.'], ['First visit', "New here? Tell us your goals and we'll take it from there."]],
        grid: ['Your first class, step by step', 'Meet the coaches', 'Move of the week', "This week's schedule", 'The early crew', 'Ask a coach', 'What to bring', 'Member spotlight', 'Come try a class'],
        lines: ['Show up as you are', 'Leave stronger', 'Same time next week?'],
        q: 'Do you have anything tonight?', a: "Let me check tonight's schedule. Want me to save you a spot?" },
      yoga: { pal: ['#f4f1ea', '#1c2420', '#7c9a7e'], serif: true, cta: 'Book a class', hero: 'An hour that is just yours.', sub: 'Classes in {city}, for every body.', ask: 'classes',
        secs: [['Classes', 'Find a time that fits your week.'], ['New here', 'What to bring, and what your first class is like.'], ['Teachers', 'Meet the people who will guide you.']],
        grid: ['Your first class, step by step', 'Meet the teachers', 'Pose of the week', "This week's schedule", 'Inside the studio', 'Ask a teacher', 'What to bring', 'Student spotlight', 'Roll out a mat with us'],
        lines: ['Breathe out the week', 'Every level, every body', 'Roll out the mat'],
        q: 'Is there a class for total beginners?', a: 'I can find a good first class for you. Want me to check this week?' },
      restaurants: { pal: ['#1a1410', '#f6efe6', '#e0a33a'], cta: 'See the menu', hero: 'Come hungry.', sub: 'Good food and good company in {city}.', ask: 'dishes',
        secs: [['Menu', 'The dishes people come back for.'], ['Plan ahead', 'Call ahead, or just come in.'], ['Visit', 'Find us in {city}.']],
        grid: ['The dish everyone orders', 'Meet the kitchen', "This week's special", 'Behind the pass', 'How we make it', 'Staff picks', 'Date night', "A regular's favorite", 'See you tonight'],
        lines: ['Hungry yet?', 'Pull up a chair', 'Save room'],
        q: 'Can I get a table for 6 on Friday?', a: "Let me check Friday for you. What time were you thinking?" },
      salons: { pal: ['#f7f2ef', '#2b1b17', '#c47a5a'], cta: 'Book an appointment', hero: 'Your next favorite cut.', sub: 'Cuts and styling in {city}.', ask: 'looks',
        secs: [['Services', 'Everything we offer, in one place.'], ['Stylists', 'Find the right person for your hair.'], ['Book', 'Pick a time that works for you.']],
        grid: ['Before and after', 'Meet the stylists', 'Look of the week', 'Book your chair', 'Inside the salon', 'Ask a stylist', 'Hair care tips', 'Behind the chair', 'Fresh cut, fresh week'],
        lines: ['New week', 'New cut', 'Book your chair'],
        q: 'Can I get a cut on Saturday?', a: 'Let me check Saturday for you. Do you have a stylist you like, or should I find the first opening?' },
      medspas: { pal: ['#f6f4f1', '#2a2a2a', '#b59a7a'], serif: true, cta: 'Book a consult', hero: 'Skin care, made personal.', sub: 'Treatments and consults in {city}.', ask: 'treatments',
        secs: [['Treatments', 'Find the right one for your skin.'], ['First visit', 'Start with a consult and a plan.'], ['Questions', 'Ask us anything before you book.']],
        grid: ['What a first visit looks like', 'Meet the team', 'Treatment of the month', 'Your questions, answered', 'Inside the space', 'Aftercare tips', 'Skin myths', 'A day at the spa', 'Book a consult'],
        lines: ['Your skin, your plan', 'Start with a consult', 'Glow on your schedule'],
        q: 'How long does a first visit take?', a: 'It depends on the treatment, so most people start with a consult. Want me to find you a time this week?' },
      dentists: { pal: ['#ffffff', '#0f2a3d', '#2a9d8f'], cta: 'Book a visit', hero: 'Dental care in {city}.', sub: 'Checkups, cleanings and the care in between.', ask: 'care',
        secs: [['New patients', 'Tell us a little about you and pick a time.'], ['Your visit', 'What to expect, start to finish.'], ['Find us', 'Hours, parking and directions.']],
        q: 'Can I get in this week? My tooth has been bugging me.', a: "Sorry to hear that. Let me check this week's openings. Do mornings or afternoons work better?" },
      chiro: { pal: ['#f3f7f9', '#14303f', '#3a86c8'], cta: 'Book a visit', hero: 'Move better, feel better.', sub: 'Care that keeps you moving, in {city}.', ask: 'care',
        secs: [['First visit', 'What happens in your first session.'], ['Care plans', 'A plan built around how you move.'], ['Find us', 'Hours, parking and directions.']],
        q: 'Do you take walk-ins?', a: 'Booking ahead gets you a time that suits you. Want me to find the next opening?' },
      realtors: { pal: ['#ffffff', '#1d1d1f', '#1f5f8b'], cta: 'Get in touch', hero: 'Find your place in {city}.', sub: 'Buying or selling, start with a conversation.', ask: 'homes',
        secs: [['Buying', 'Tell us what you are looking for.'], ['Selling', 'Find out what your home could list for.'], ['Neighborhoods', 'A local guide to {city}.']],
        grid: ['Just listed', 'Meet the agent', 'Neighborhood guide', 'Open house this weekend', 'Market update', 'Before you buy', 'Home tour', 'First-time buyer tips', "Let's talk"],
        lines: ['Take the tour', 'Picture yourself here', 'Book a showing'],
        shots: ['The front of the house', 'The kitchen in daylight', 'The living room, wide', 'The best view', 'The backyard', 'The main bedroom', 'The details buyers miss', 'The street at golden hour', 'The agent at the door'],
        q: 'Is that new listing still available?', a: 'Let me check for you. Would you like to set up a showing?' },
      contractors: { pal: ['#ffffff', '#1b1f24', '#f28c28'], cta: 'Request service', hero: 'Repairs, installs and service in {city}.', sub: "Tell us what's going on and we'll get back to you.", ask: 'projects',
        secs: [['Repairs', 'Something broken? Send a photo and a few words.'], ['Installs', 'Planning an upgrade? Get a quote first.'], ['Service area', 'Based in {city}.']],
        q: 'Something stopped working. Can someone come out this week?', a: "Sorry to hear that. What's going on, and when is a good time? I'll get you on the schedule." },
      auto: { pal: ['#121417', '#f2f2f2', '#e63946'], cta: 'Book service', hero: 'Your car, taken care of.', sub: 'Car care in {city}.', ask: 'services',
        secs: [['Services', 'Tell us what your car needs.'], ['Book a time', 'Pick a time that works for you.'], ['Find us', 'Hours and directions.']],
        q: 'Can you fit my car in this week?', a: "Let me see what's open. What's the year, make and model?" },
      boutiques: { pal: ['#fbf8f4', '#2d2a26', '#9c6b4e'], serif: true, cta: 'Shop new arrivals', hero: 'New this week.', sub: 'A local shop in {city}.', ask: 'pieces',
        secs: [['New arrivals', 'Fresh pieces, a few at a time.'], ['Gifts', 'Something for everyone on your list.'], ['Visit', 'Find us in {city}.']],
        grid: ['New this week', 'Meet the owner', 'Staff pick', 'Styled three ways', 'Gift ideas', 'Inside the shop', 'Just restocked', 'A customer favorite', 'Come say hi'],
        q: 'Do you have this in a medium?', a: 'Let me check for you. Want me to hold one at the counter?' },
      law: { pal: ['#ffffff', '#1f2a37', '#7a5c2e'], serif: true, cta: 'Book a consultation', hero: 'Talk to a lawyer in {city}.', sub: 'Clear answers and a plan for your next step.', ask: 'questions',
        secs: [['How we help', 'Start with a short call about your situation.'], ['What to expect', 'Plain answers and a clear next step.'], ['Contact', 'Call, email or book a time.']],
        q: 'Do you handle cases like mine?', a: "I can set up a short call so you can explain what's going on. What's the best time to reach you?" },
    },
  };

  // ---------- niche doors (/first-25/gyms and friends): ads and keywords open on one niche ----------
  // The page says what the ad says (research R28). h1 names the job, never a result.
  var niches = {
    gyms: { pack: 'video', buyer: 'gyms', h1: 'Find 25 gyms to make videos for.', lede: "Type your city. We'll find the independent gyms near you, check each website for video, and write the message to send each one.", og: 'Find 25 gyms to make videos for · 127' },
    contractors: { pack: 'ai', buyer: 'contractors', h1: 'Find 25 contractors to set up booking for.', lede: "Type your city. We'll find independent plumbing, HVAC and roofing companies, check each website for online booking and chat, and write the message to send each one.", og: 'Find 25 contractors to set up booking for · 127' },
    restaurants: { pack: 'social', buyer: 'restaurants', h1: 'Find 25 restaurants to run social for.', lede: "Type your city. We'll find the independent restaurants near you, check each website for Instagram, TikTok and photos, and write the message to send each one.", og: 'Find 25 restaurants to run social for · 127' },
    shops: { pack: 'social', buyer: 'boutiques', h1: 'Find 25 local shops to run social for.', lede: "Type your city. We'll find the independent boutiques and gift shops near you, check each website for Instagram and photos, and write the message to send each one.", og: 'Find 25 local shops to run social for · 127' },
  };

  var copy = {
    problem: "You don't need a better idea. You need a list.",
    problemSub: "An idea can't pay you. A customer can. Here are 25 who could, and what to say to each one.",
    checked: 'We checked each homepage on {date}. Things change, so look before you send.',
    sampleNote: 'Sample businesses. They are made up so you can see how it works.',
    attribution: {
      sample: 'Sample data. These businesses are made up.',
      // The page shows Google's attribution as its own mark next to this line (copy.gmaps, Legal L53 part 1.5).
      google: 'Google Maps. Website checks by 127.',
      osm: 'Business listings © OpenStreetMap contributors (openstreetmap.org/copyright). Website checks by 127.',
    },
    emailOptOut: 'P.S. Not for you? Reply "no thanks" and I won\'t follow up.',
    // Every cold email ends with the sender's mailing address and the opt-out (Legal L53 part 3.1, CAN-SPAM).
    addr: { label: 'Your mailing address', placeholder: 'e.g. PO Box 123, Ames, IA 50010', help: 'US law asks for a mailing address in sales emails. A PO box or virtual mailbox works.' },
    asEmail: 'Copy as email',
    // A no ends it (Legal L53 part 3.2).
    noFollow: "They said no, so this one doesn't get sent. A no ends it.",
    followNote: 'If they said no, mark them Not now. A no ends it.',
    walkNote: 'Call during business hours. If you walk in, skip any business with a "No soliciting" sign.',
    // The fact in each message, with a link to see it for yourself (Legal L53 part 3.4).
    check: 'Check it first ↗',
    // Live searches name their source under the button (Legal L53 parts 1.6 and 2.5). {terms} links /terms#13b-first-25.
    srcLine: {
      google: "Business info from Google Maps. By searching, you agree to our {terms}, including Google Maps' terms.",
      osm: 'Business info from OpenStreetMap. By searching, you agree to our {terms}.',
    },
    gmaps: 'Google Maps',
    // LocationIQ's free plan: its link, in its words, wherever its city search is used (the line above and the credits).
    searchBy: { locationiq: { text: 'Search by LocationIQ.com', url: 'https://locationiq.com' } },
    checksBy: 'Website checks by 127.',
    // A saved Google list keeps place IDs only, so it loads names from Google Maps each time it opens (Legal L53 part 1.1).
    details: {
      loading: 'Loading your list from Google Maps.',
      fail: "Some business names didn't load from Google Maps just now. Your messages, samples and tracker are all here. Refresh to try again.",
    },
    noName: '[business name]',
    csvGoogle: 'Download your tracker for Sheets or Notion',
    csvGoogleNote: 'Business names stay on Google Maps, so the file has a map link for each one instead.',
    csvGoogleFile: 'Business names and details come from Google Maps and stay there. Open each map link to see them.',
    follow2: "Last note from me. If {sell} isn't a priority right now, no problem at all. If it is, the first one is still free.",
    // A count we can stand behind: {checks} is the number of website checks in first25-engine.js. No time-saved claims until timed by hand (R21).
    saved: 'We read {n} websites and checked each one for {checks} things.',
    saved1: 'We read their website and checked it for {checks} things.',
    // Sample lists read no real websites, so they say what a real search does instead.
    savedSample: 'With real businesses, we read each website and check it for {checks} things.',
    priceTip: 'One package, one price, one start date. Make the first month an easy yes, and raise your price after 3 happy clients.',
    keep: 'Your list and tracker stay here until {date}.',
    sendDone: "That's {n} sent. On day 3, send the Day 3 note to anyone who hasn't answered. It's on each card.",
    won: 'First client. Reply to your First 25 email and tell Eli how it happened.',
    // The next problem, named (what the free tool leaves undone).
    nextLabel: "What's left",
    next: 'You have {n} names and {n} drafts.',
    nextSub: 'Next comes the part most people skip: the day 3 follow-up, the call, and a price they can say yes to.',
    // Free next to Builder (playbook 1.5, the decoy). Builder lines are only things Builder has today
    // (conversion/offer.md §2), never that a plan gets you clients or leads (Legal L62).
    // builderHq shows only when the HQ card is on (results-data.js first25.hq).
    compare: {
      freeLabel: 'Free', builderLabel: 'Builder adds',
      free: ['Your {n}, ranked, with what each one is missing', 'The first message and 2 follow-ups for each', 'Reply scripts for 7 moments', 'A mock-up for #1, and the steps for a free sample for your top 3', 'A file for Sheets or Notion'],
      freeNoSample: ['Your {n}, ranked, with what each one is missing', 'The first message and 2 follow-ups for each', 'Reply scripts for 7 moments', 'The steps for a free sample for your top 3', 'A file for Sheets or Notion'],
      builder: ['The Pricing Worksheet and One-Page Offer, so your price is ready when they ask', 'The Outreach Scripts', "Eli's Playbook for the replies, about 300 AI messages a month", 'All 4 weeks of your roadmap'],
      builderHq: ['Follow-ups dated and tracked in 127 HQ'],
      email: "Free gives you the list, the messages, the follow-ups and the reply scripts. Builder adds the Pricing Worksheet, the One-Page Offer, the Outreach Scripts and Eli's Playbook for the replies.",
    },
    // The email gate when there's a sample for #1 (results-kit.js R.gate copy).
    gateSample: 'Get all {n}, plus {short} for {biz}.',
    gateLine: 'All {n} ranked, a DM, email and walk-in line for each, 2 follow-ups, the steps for a free sample for your top 3, and a file for Sheets or Notion.',
    peek: 'Mock-up for {biz} · Unlocks with your email',
    savedHead: 'Your {n} are saved.',
    capped: 'Live search is at its limit for today, so this is a sample list. Come back tomorrow for real businesses near you.',
    emailSample: 'We made a mock-up for #1, {biz}: {title}. Open your list to see it. {note}',
    // Google runs: the email carries 127's own findings and the link, never a business name (Legal L53 part 1.3).
    emailFound: 'What we found on their websites:',
    emailTop1: 'Your #1: {why}',
    emailSampleGoogle: "We made a mock-up for #1: {title}. Open your list to see it, with the steps to make the real one. It's only for them, so never post it.",
    emailRestGoogle: 'Every name, message, reply script and your tracker are on your list page.',
    csvLineGoogle: 'Download your tracker for Sheets or Notion: {url}',
  };

  return { buyers: buyers, gaps: gaps, fits: fits, packs: packs, specs: specs, hooks: hooks, plan: plan, stages: stages, replies: replies, picker: picker, stack: stack, mock: mock, niches: niches, copy: copy };
});
