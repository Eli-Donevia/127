// The generation part of the studio pack: AI clips, images, talking clips and sound (lib/gen.js picks
// the model), the scripts and shot plans behind them, and the workflows that join them into finished
// ads and videos with the editing part's studio.assemble. Ad angles come from the ads desk
// (ads.find_angles), so the creatives line up with the ads it writes (W11).

const ASPECT = { type: 'string', title: 'Shape', enum: ['9:16', '1:1', '4:5', '16:9'], default: '9:16', description: '9:16 for Reels, TikTok and Shorts; 1:1 or 4:5 for feeds; 16:9 for YouTube.' };
const PHOTO = { type: 'string', format: 'asset', accept: 'image/*', title: 'A photo of your product' };
const PRODUCT = { type: 'string', title: 'What you sell', description: 'In a few words, like "soy candles in amber jars"', maxLength: 160 };
const POINTS = { type: 'string', format: 'textarea', title: 'What to say (optional)', description: 'One point per line: what it does, what is included, the price', maxLength: 1200 };
// Legal L76 part 5, word for word. V1: adding a real person's photo, video or voice needs this box.
const { CONSENT_TEXT } = require('./clip-tool');
const CONSENT = { type: 'boolean', title: CONSENT_TEXT, default: false };
const PEOPLE = { type: 'boolean', title: CONSENT_TEXT, default: false, description: 'Tick it if your photo shows a person. Leave it if it shows only your product.' };
// V7: the line on any recording that gets transcribed.
const RECORDING = 'Only add recordings everyone in them agreed to. Some states require everyone\'s OK to record a call.';
const LOOK = { type: 'string', title: 'Look (optional)', maxLength: 120, description: 'Like "bright and clean", "warm and moody", "shot on a phone"' };

const tools = [
  require('../tools/make-clip'),
  require('../tools/make-clip-pro'),
  require('../tools/make-image'),
  require('../tools/make-talking'),
  require('../tools/make-sound'),
  require('../tools/write-shots'),
  require('../tools/write-script'),
  require('../tools/pick-broll'),
];

const obj = (properties, required = []) => ({ type: 'object', properties, required });

// Pick one of the scripts, then read and edit it.
const pickScript = (from) => [
  { id: 'pick', approve: { title: 'Pick the script you like best', choose: `$${from}.scripts`, label: 'title', max: 1 } },
  { id: 'edit', approve: { title: 'Read it out loud once and edit anything that does not sound like you', items: '$pick.chosen', edit: 'text' } },
];

const workflows = [
  {
    id: 'studio.product_ad',
    title: 'Turn a product photo into a video ad',
    promise: 'Three AI shots of your product from one photo, cut into a short ad with your hook, music and end card.',
    proof: 'A finished vertical ad, its three clips, and the words used for each shot',
    minutes: 8,
    tier: 'builder',
    job: 'content',
    inputs: obj({ photo: PHOTO, people: PEOPLE, product: PRODUCT, hook: { type: 'string', title: 'Your hook (optional)', description: 'The line on screen in the first seconds', maxLength: 90 }, look: LOOK, aspect: ASPECT }, ['photo', 'product']),
    steps: [
      { id: 'shots', tool: 'studio.write_shots', input: { kind: 'product', subject: '$inputs.product', look: '$inputs.look', count: 3, seconds: 5 } },
      { id: 'check', approve: { title: 'Read the shots before the model makes them', items: '$shots.shots', edit: 'text' } },
      { id: 'clips', tool: 'studio.make_clip', each: '$check.items', input: { shot: '$item', photo: '$inputs.photo', people: '$inputs.people', product: '$inputs.product', aspect: '$inputs.aspect' }, concurrency: 2, estimate: 3 },
      { id: 'ad', tool: 'studio.assemble', input: { scenes: '$clips', hook: '$inputs.hook', product: '$inputs.product', music: true, outro: true, aspect: '$inputs.aspect' } },
    ],
    result: ['ad', 'clips'],
    next: [{ id: 'studio.image_ads', why: 'Same product, still ads in every size.' }, { id: 'studio.ugc_ad', why: 'Add a voice and captions.' }],
  },
  {
    id: 'studio.ugc_ad',
    title: 'Make a UGC-style ad',
    promise: 'A short phone-style ad: a script in your words, a voiceover, AI shots of your product and word-by-word captions.',
    proof: 'A captioned vertical ad, the script and the voiceover',
    minutes: 10,
    tier: 'builder',
    job: 'content',
    inputs: obj({ product: PRODUCT, points: POINTS, audience: { type: 'string', title: 'Who it is for (optional)', maxLength: 160 }, photo: { ...PHOTO, title: 'A photo of your product (optional)' }, people: PEOPLE, voice: { type: 'string', title: 'Voice', enum: ['female', 'male'], default: 'female' }, aspect: ASPECT }, ['product']),
    steps: [
      { id: 'script', tool: 'studio.write_script', input: { style: 'ugc', product: '$inputs.product', points: '$inputs.points', audience: '$inputs.audience', seconds: 20, variants: 2 } },
      ...pickScript('script'),
      { id: 'voice', tool: 'video.voice', input: { script: '$edit.items.0', gender: '$inputs.voice' } },
      { id: 'shots', tool: 'studio.write_shots', input: { kind: 'ugc', subject: '$inputs.product', script: '$edit.items.0', count: 3, seconds: 5 } },
      { id: 'clips', tool: 'studio.make_clip', each: '$shots.shots', input: { shot: '$item', photo: '$inputs.photo', people: '$inputs.people', product: '$inputs.product', aspect: '$inputs.aspect' }, concurrency: 2, estimate: 3 },
      { id: 'ad', tool: 'studio.assemble', input: { scenes: '$clips', voice: '$voice.audio', words: '$voice.words', captions: 'bold', product: '$inputs.product', music: true, outro: true, aspect: '$inputs.aspect', labels: { person: true, voice: true }, ugc: true } },
    ],
    result: ['ad', 'edit', 'voice'],
    next: [{ id: 'studio.hook_variants', why: 'Test five openings on the same ad.' }, { id: 'studio.talking_ad', why: 'The same script, spoken by you.' }],
  },
  {
    id: 'studio.talking_ad',
    title: 'Make a talking clip from your photo',
    promise: 'Your photo speaking your script, lips in sync, with captions and your end card.',
    proof: 'A captioned talking clip and its script',
    minutes: 8,
    tier: 'builder',
    job: 'content',
    inputs: obj({ face: { type: 'string', format: 'asset', accept: 'image/*,video/*', title: 'A clear photo of you facing the camera', description: 'Your own face, or someone who agreed in writing' }, consent: CONSENT, product: PRODUCT, points: POINTS, voice: { type: 'string', title: 'Voice', enum: ['female', 'male'], default: 'female' }, aspect: ASPECT }, ['face', 'product']),
    steps: [
      { id: 'script', tool: 'studio.write_script', input: { style: 'talking', product: '$inputs.product', points: '$inputs.points', seconds: 15, variants: 2 } },
      ...pickScript('script'),
      { id: 'voice', tool: 'video.voice', input: { script: '$edit.items.0', gender: '$inputs.voice' } },
      { id: 'talk', tool: 'studio.make_talking', input: { face: '$inputs.face', consent: '$inputs.consent', voice: '$voice.audio', aspect: '$inputs.aspect', maxSeconds: 20 } },
      { id: 'ad', tool: 'studio.assemble', input: { scenes: '$talk', words: '$voice.words', captions: 'bold', product: '$inputs.product', music: false, outro: true, aspect: '$inputs.aspect', keepAudio: true, labels: { video: true, voice: true } } },
    ],
    result: ['ad', 'edit'],
    next: [{ id: 'studio.ugc_ad', why: 'Cut the same message over product shots.' }],
  },
  {
    id: 'studio.faceless_video',
    title: 'Make a faceless video from a topic',
    promise: 'A short faceless video: a script, a voiceover, an AI picture for every line and word-by-word captions.',
    proof: 'A captioned vertical video, its script and its pictures',
    minutes: 8,
    tier: 'builder',
    job: 'content',
    inputs: obj({ topic: { type: 'string', title: 'The topic', description: 'Like "3 mistakes people make when buying a mattress"', maxLength: 200 }, points: POINTS, voice: { type: 'string', title: 'Voice', enum: ['female', 'male'], default: 'female' }, look: LOOK, aspect: ASPECT }, ['topic']),
    steps: [
      { id: 'script', tool: 'studio.write_script', input: { style: 'faceless', product: '$inputs.topic', points: '$inputs.points', seconds: 30, variants: 2 } },
      ...pickScript('script'),
      { id: 'voice', tool: 'video.voice', input: { script: '$edit.items.0', gender: '$inputs.voice' } },
      { id: 'shots', tool: 'studio.write_shots', input: { kind: 'faceless', subject: '$inputs.topic', script: '$edit.items.0', look: '$inputs.look', count: 6, seconds: 5 } },
      { id: 'pictures', tool: 'studio.make_image', each: '$shots.shots', input: { shot: '$item', aspect: '$inputs.aspect' }, concurrency: 3, estimate: 6 },
      { id: 'video', tool: 'studio.assemble', input: { scenes: '$pictures', voice: '$voice.audio', words: '$voice.words', captions: 'bold', music: true, outro: false, aspect: '$inputs.aspect', labels: { voice: true } } },
    ],
    result: ['video', 'edit'],
    next: [{ id: 'studio.video_prompts', why: 'Prompts to make the pictures move.' }],
  },
  {
    id: 'studio.image_ads',
    title: 'Make image ads in every size',
    promise: 'Up to 3 ad angles, an AI scene for each built around your product, and every ad in 5 placement sizes.',
    proof: 'Ad images for feed, portrait, Stories, link and wide placements, zipped',
    minutes: 6,
    tier: 'builder',
    job: 'ads',
    inputs: obj({ product: PRODUCT, photo: { ...PHOTO, title: 'A photo of your product (optional)' }, people: PEOPLE, price: { type: 'number', title: 'Price (optional)', minimum: 0 }, look: LOOK }, ['product']),
    steps: [
      { id: 'angles', tool: 'ads.find_angles', input: { service: '$inputs.product', price: '$inputs.price' } },
      { id: 'pick', approve: { title: 'Pick up to 3 angles to make ads for', choose: '$angles.angles', label: 'name', max: 3 } },
      { id: 'shots', tool: 'studio.write_shots', input: { kind: 'product', subject: '$inputs.product', angles: '$pick.chosen', look: '$inputs.look', seconds: 5 } },
      { id: 'scenes', tool: 'studio.make_image', each: '$shots.shots', input: { shot: '$item', photo: '$inputs.photo', people: '$inputs.people', product: '$inputs.product', aspect: '1:1' }, concurrency: 3, estimate: 3 },
      { id: 'ads', tool: 'studio.ad_sizes', input: { scenes: '$scenes', angles: '$pick.chosen', product: '$inputs.product', price: '$inputs.price' } },
    ],
    result: ['ads', 'scenes'],
    next: [{ id: 'studio.video_ads', why: 'The same angles as short video ads.' }, { id: 'ads.launch_kit', why: 'The ad words and the test plan.' }],
  },
  {
    id: 'studio.video_ads',
    title: 'Make a video ad for each angle',
    promise: 'Up to 3 ad angles, each a short vertical video ad that opens on its hook, made from your product photo.',
    proof: 'One finished video ad per angle',
    minutes: 8,
    tier: 'builder',
    job: 'ads',
    inputs: obj({ product: PRODUCT, photo: PHOTO, people: PEOPLE, price: { type: 'number', title: 'Price (optional)', minimum: 0 }, look: LOOK, aspect: ASPECT }, ['product', 'photo']),
    steps: [
      { id: 'angles', tool: 'ads.find_angles', input: { service: '$inputs.product', price: '$inputs.price' } },
      { id: 'pick', approve: { title: 'Pick up to 3 angles to make video ads for', choose: '$angles.angles', label: 'name', max: 3 } },
      { id: 'shots', tool: 'studio.write_shots', input: { kind: 'product', subject: '$inputs.product', angles: '$pick.chosen', look: '$inputs.look', seconds: 5 } },
      { id: 'clips', tool: 'studio.make_clip', each: '$shots.shots', input: { shot: '$item', photo: '$inputs.photo', people: '$inputs.people', product: '$inputs.product', aspect: '$inputs.aspect' }, concurrency: 2, estimate: 3 },
      { id: 'ads', tool: 'studio.assemble', each: '$clips', input: { scenes: '$item', product: '$inputs.product', music: true, outro: true, aspect: '$inputs.aspect' }, concurrency: 1, estimate: 3 },
    ],
    result: ['ads'],
    next: [{ id: 'studio.image_ads', why: 'Still ads for the same angles.' }, { id: 'ads.launch_kit', why: 'The ad words and the test plan.' }],
  },
  {
    id: 'studio.ai_broll',
    title: 'Add AI b-roll to your talking video',
    promise: 'Finds up to 3 spots in your video that need b-roll, makes an AI clip for each and cuts them in.',
    proof: 'Your video with b-roll cut in, and each b-roll clip',
    minutes: 8,
    tier: 'builder',
    job: 'content',
    inputs: obj({ video: { type: 'string', format: 'asset', accept: 'video/*', title: 'Your talking video', description: `Up to 10 minutes. ${RECORDING}` }, topic: { type: 'string', title: 'What it is about', maxLength: 200 }, aspect: ASPECT }, ['video', 'topic']),
    steps: [
      { id: 'src', tool: 'video.load_video', input: { file: '$inputs.video', maxMinutes: 10 } },
      { id: 'words', tool: 'video.transcribe', each: '$src.blocks', input: { source: '$src.source', block: '$item' }, concurrency: 3, estimate: 5 },
      { id: 'moments', tool: 'studio.pick_broll', input: { words: '$words', seconds: '$src.seconds', topic: '$inputs.topic', count: 3, clip: 3 } },
      { id: 'check', approve: { title: 'Read the b-roll shots before the model makes them', items: '$moments.moments', edit: 'text' } },
      { id: 'clips', tool: 'studio.make_clip', each: '$check.items', input: { shot: '$item', aspect: '$inputs.aspect', seconds: 5 }, concurrency: 2, estimate: 3 },
      { id: 'final', tool: 'studio.edit_broll', input: { video: '$inputs.video', clips: '$clips' } },
    ],
    result: ['final', 'clips'],
    next: [{ id: 'studio.edit_video', why: 'Clean cuts, captions and music.' }],
  },
  {
    id: 'studio.ai_clips',
    title: 'Make AI video clips from your words',
    promise: 'Describe what you want; get up to 3 short AI clips, planned shot by shot.',
    proof: 'Up to 3 clips and the words used for each',
    minutes: 5,
    tier: 'builder',
    job: 'content',
    inputs: obj({ about: { type: 'string', title: 'What you want to see', maxLength: 300 }, kind: { type: 'string', title: 'Kind', enum: ['product', 'cinematic', 'broll', 'faceless', 'ugc'], default: 'cinematic' }, photo: { ...PHOTO, title: 'Start from a photo (optional)' }, people: PEOPLE, count: { type: 'integer', title: 'How many clips', minimum: 1, maximum: 3, default: 2 }, look: LOOK, aspect: ASPECT }, ['about']),
    steps: [
      { id: 'shots', tool: 'studio.write_shots', input: { kind: '$inputs.kind', subject: '$inputs.about', look: '$inputs.look', count: '$inputs.count', seconds: 5 } },
      { id: 'check', approve: { title: 'Read the shots before the model makes them', items: '$shots.shots', edit: 'text' } },
      { id: 'clips', tool: 'studio.make_clip', each: '$check.items', input: { shot: '$item', photo: '$inputs.photo', people: '$inputs.people', aspect: '$inputs.aspect' }, concurrency: 2, estimate: 3 },
    ],
    result: ['clips'],
    next: [{ id: 'studio.edit_video', why: 'Cut them together with music and captions.' }],
  },
];

module.exports = { tools, workflows, CONSENT_TEXT, RECORDING };
