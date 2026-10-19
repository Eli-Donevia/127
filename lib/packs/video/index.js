// Video studio: captioned clips from one long video, word-by-word captions for any video, kinetic-text
// promos and faceless shorts in the member's colors, thumbnails, and a shot list before you film.
// Real MP4s (H.264, AAC, 1080x1920) rendered with ffmpeg and libass; the kit's media module
// (packs/_kit/media.js) does the heavy lifting. The voice and stock footage tools work without keys:
// without them you get the free computer voice (or reading-pace timings) and links to search yourself.

const { KINDS } = require('./lib/shoot');

const UPLOAD = { type: 'string', format: 'asset', accept: 'video/*,audio/*', title: 'Your video', description: 'MP4 or MOV from your phone or computer' };
const LINK = { type: 'string', title: 'Or paste a link to the video file', description: 'Dropbox, Google Drive or any public link that opens the file', maxLength: 2000 };
const STYLE = { type: 'string', title: 'Caption style', enum: ['bold', 'box', 'clean'], default: 'bold', description: 'bold: big words, the spoken one lights up. box: the spoken word sits on a box in your color. clean: smaller, sentence case.' };
const HANDLE = { type: 'string', title: 'Your @handle (optional)', maxLength: 40 };
const FOOTAGE = { type: 'array', title: 'Your own clips or photos (optional)', description: 'Up to 6. They play behind the words, one per scene, darkened a little so the words read.', items: { type: 'string', format: 'asset', accept: 'video/*,image/*' }, maxItems: 6 };

module.exports = {
  id: 'video',
  title: 'Video studio',
  version: '0.2.0',
  summary: 'Turn one long video into captioned clips, caption any video word by word, make promo videos, faceless shorts and thumbnails in your colors, and plan a shoot before you film.',
  niches: [],
  business: false,
  system: ['ffmpeg'],
  tools: [
    require('./tools/load-video'),
    require('./tools/transcribe'),
    require('./tools/find-clips'),
    require('./tools/render-clip'),
    require('./tools/captions'),
    require('./tools/write-promo'),
    require('./tools/voice'),
    require('./tools/stock'),
    require('./tools/promo'),
    require('./tools/thumbnail'),
    require('./tools/plan-shoot'),
  ],
  workflows: [
    {
      id: 'video.caption',
      title: 'Caption your video',
      promise: 'Your video back with word-by-word captions in your colors, plus SRT and VTT caption files.',
      proof: 'Your video with captions burned in, and the caption files YouTube, Instagram and TikTok take',
      minutes: 3,
      tier: 'free',
      job: 'content',
      inputs: { type: 'object', properties: { file: UPLOAD, url: LINK, style: STYLE, handle: HANDLE, layout: { type: 'string', title: 'Frame', enum: ['vertical', 'keep'], default: 'keep', description: 'keep: the shape you filmed. vertical: cropped to 9:16.' } } },
      steps: [
        { id: 'load', tool: 'video.load_video', input: { file: '$inputs.file', url: '$inputs.url', maxMinutes: 3 } },
        { id: 'words', tool: 'video.transcribe', each: '$load.blocks', concurrency: 3, estimate: 3, input: { source: '$load.source', block: '$item' } },
        { id: 'render', tool: 'video.render_clip', input: { source: '$load.source', words: '$words', style: '$inputs.style', handle: '$inputs.handle', layout: '$inputs.layout' } },
        { id: 'files', tool: 'video.captions', input: { words: '$words' } },
      ],
      result: ['render', 'files'],
      next: [
        { id: 'video.thumbnail', why: 'Make its thumbnail: big words on a frame of this video.' },
        { id: 'video.long_to_clips', why: 'Have a longer talk or podcast? Cut it into 5 captioned clips.' },
      ],
    },
    {
      id: 'video.long_to_clips',
      title: 'One long video, 5 clips',
      promise: 'The 5 best moments of a talk, podcast or live, cut to vertical clips with captions and hook titles, ready to post.',
      proof: 'Five vertical clips with captions and a title on each, plus caption files',
      minutes: 10,
      tier: 'builder',
      job: 'content',
      inputs: {
        type: 'object',
        properties: {
          file: UPLOAD,
          url: LINK,
          topic: { type: 'string', title: 'What should the clips be about? (optional)', maxLength: 200 },
          length: { type: 'string', title: 'Clip length', enum: ['short', 'medium', 'long'], default: 'medium', description: 'short 10 to 30 seconds, medium 15 to 45, long 30 to 75' },
          style: STYLE,
          handle: HANDLE,
        },
      },
      steps: [
        { id: 'load', tool: 'video.load_video', input: { file: '$inputs.file', url: '$inputs.url', maxMinutes: 90 } },
        { id: 'words', tool: 'video.transcribe', each: '$load.blocks', concurrency: 4, estimate: 20, input: { source: '$load.source', block: '$item' } },
        { id: 'clips', tool: 'video.find_clips', input: { words: '$words', count: 5, length: '$inputs.length', topic: '$inputs.topic' } },
        { id: 'pick', approve: { title: 'Pick the clips to render', choose: '$clips.clips', label: 'title', detail: 'range', max: 5, note: 'Each one becomes a vertical MP4 with captions and its title on top.' } },
        { id: 'render', tool: 'video.render_clip', each: '$pick.chosen', concurrency: 2, estimate: 5, input: { source: '$load.source', clip: '$item', style: '$inputs.style', handle: '$inputs.handle' } },
        { id: 'files', tool: 'video.captions', input: { words: '$words', clips: '$pick.chosen' } },
      ],
      result: ['render', 'files'],
      next: [
        { id: 'video.thumbnail', why: 'Make covers for the clips so they stand out in your profile grid.' },
        { id: 'video.promo', why: 'Turn your offer into a 20 second promo to post between the clips.' },
      ],
    },
    {
      id: 'video.promo',
      title: 'Promo video for your offer',
      promise: 'A 15 to 30 second promo for your offer in your colors, with motion and music, ready for Reels, TikTok and Shorts.',
      proof: 'A finished MP4 in your colors with music, and its cover image',
      minutes: 5,
      tier: 'builder',
      job: 'content',
      inputs: {
        type: 'object',
        properties: {
          offer: { type: 'string', title: 'What are you promoting? (optional, we use your profile)', maxLength: 200 },
          audience: { type: 'string', title: 'Who is it for? (optional)', maxLength: 160 },
          seconds: { type: 'integer', title: 'Length in seconds', minimum: 10, maximum: 45, default: 20 },
          format: { type: 'string', title: 'Shape', enum: ['vertical', 'square', 'wide'], default: 'vertical' },
          color: { type: 'string', title: 'Brand color (optional hex, like #1f7a8c)', maxLength: 9 },
          voice: { type: 'string', title: 'Voiceover', enum: ['off', 'female', 'male'], default: 'off' },
          footage: FOOTAGE,
          stock: { type: 'string', title: 'Or stock footage to search for (optional)', maxLength: 80 },
        },
      },
      steps: [
        { id: 'script', tool: 'video.write_promo', input: { kind: 'promo', offer: '$inputs.offer', audience: '$inputs.audience', seconds: '$inputs.seconds' } },
        { id: 'check', approve: { title: 'Read and edit your script', items: '$script.scripts', edit: 'text', label: 'title', note: 'One line per scene: HOOK, OFFER (name | what it is), POINT, PRICE, CTA (action | site). Change any words you like.' } },
        { id: 'render', tool: 'video.promo', each: '$check.items', estimate: 1, input: { script: '$item', format: '$inputs.format', seconds: '$inputs.seconds', color: '$inputs.color', voice: '$inputs.voice', footage: '$inputs.footage', stock: '$inputs.stock' } },
      ],
      result: ['render'],
      next: [
        { id: 'video.shoot_plan', why: 'Film your own version next: a shot list for this promo.' },
        { id: 'video.faceless_short', why: 'Post tips between promos: a short from your own points.' },
      ],
    },
    {
      id: 'video.faceless_short',
      title: 'Faceless short from your points',
      promise: 'A 20 to 40 second faceless short: your points one big line at a time, in your colors, with music and an optional voiceover.',
      proof: 'A vertical MP4 with your points, music and a cover image',
      minutes: 5,
      tier: 'builder',
      job: 'content',
      inputs: {
        type: 'object',
        properties: {
          topic: { type: 'string', title: 'Topic', maxLength: 160 },
          points: { type: 'string', title: 'Your points, one per line', maxLength: 1500 },
          seconds: { type: 'integer', title: 'Length in seconds', minimum: 15, maximum: 60, default: 25 },
          voice: { type: 'string', title: 'Voiceover', enum: ['off', 'female', 'male'], default: 'off' },
          footage: FOOTAGE,
          stock: { type: 'string', title: 'Or stock footage to search for (optional)', maxLength: 80 },
        },
      },
      steps: [
        { id: 'script', tool: 'video.write_promo', input: { kind: 'faceless', topic: '$inputs.topic', points: '$inputs.points', seconds: '$inputs.seconds' } },
        { id: 'check', approve: { title: 'Read and edit your lines', items: '$script.scripts', edit: 'text', label: 'title', note: 'HOOK first, then one LINE per point, then CTA. Keep each line short enough to read in two seconds.' } },
        { id: 'render', tool: 'video.promo', each: '$check.items', estimate: 1, input: { script: '$item', format: 'vertical', seconds: '$inputs.seconds', voice: '$inputs.voice', footage: '$inputs.footage', stock: '$inputs.stock' } },
      ],
      result: ['render'],
      next: [
        { id: 'video.thumbnail', why: 'Make its cover so it stands out in your profile grid.' },
        { id: 'video.promo', why: 'Next, a promo for your offer in the same colors.' },
      ],
    },
    {
      id: 'video.thumbnail',
      title: 'Make thumbnails',
      promise: 'Three thumbnail designs with big words on your photo or a frame of your video, sized for YouTube and for Shorts, Reels and TikTok covers.',
      proof: 'Your top pick as a JPG under 2 MB, a sheet of all three at phone size, and every size in a zip',
      minutes: 3,
      tier: 'builder',
      job: 'content',
      inputs: {
        type: 'object',
        required: ['text'],
        properties: {
          text: { type: 'string', title: 'Words on the thumbnail (2 to 5 is best)', description: 'The thing people should see first, like "Saturn could float". The title says the rest.', maxLength: 60 },
          image: { type: 'string', format: 'asset', accept: 'image/*,video/*', title: 'Your photo or video (optional)', description: 'A photo, or a video we take a frame from. Without one, the designs use your colors.' },
          title: { type: 'string', title: 'Video title (optional)', maxLength: 100 },
          shape: { type: 'string', title: 'Shape', enum: ['wide', 'tall', 'both'], default: 'wide', description: 'wide: YouTube videos (1920 x 1080). tall: Shorts, Reels and TikTok covers (1080 x 1920). both: one of each.' },
          sub: { type: 'string', title: 'Small label on top (optional)', description: 'Like "Part 2" or "New".', maxLength: 24 },
          color: { type: 'string', title: 'Brand color (optional hex, like #1f7a8c)', maxLength: 9 },
        },
      },
      steps: [{ id: 'thumbs', tool: 'video.thumbnail', input: { text: '$inputs.text', title: '$inputs.title', sub: '$inputs.sub', image: '$inputs.image', color: '$inputs.color', shape: '$inputs.shape' } }],
      result: ['thumbs'],
      next: [
        { id: 'video.caption', why: 'Caption the video it goes on, word by word.' },
        { id: 'video.shoot_plan', why: 'Plan the next video before you film it.' },
      ],
    },
    {
      id: 'video.shoot_plan',
      title: 'Plan a video shoot',
      promise: 'A shot list for one short video: what to film, how close, what to say and the order to film it in, with a storyboard and a permission text.',
      proof: 'A printable shoot plan with a storyboard, the shot list as a spreadsheet, and the storyboard picture',
      minutes: 4,
      tier: 'builder',
      job: 'content',
      inputs: {
        type: 'object',
        required: ['about'],
        properties: {
          about: { type: 'string', title: 'What is the video about?', description: 'Like "our free reading check" or "how to keep a sourdough starter alive".', maxLength: 160 },
          kind: { type: 'string', title: 'Kind of video', enum: KINDS, default: KINDS[0] },
          seconds: { type: 'integer', title: 'Length in seconds', minimum: 15, maximum: 180, default: 45 },
          shape: { type: 'string', title: 'Shape', enum: ['vertical', 'wide', 'square'], default: 'vertical', description: 'vertical: Reels, TikTok and Shorts. wide: YouTube and your website. square: feeds.' },
          where: { type: 'string', title: 'Where will you film? (optional)', maxLength: 100 },
          people: { type: 'string', title: 'Who is on camera? (optional)', maxLength: 140 },
          date: { type: 'string', format: 'date', title: 'Shoot day (optional)' },
        },
      },
      steps: [{ id: 'plan', tool: 'video.plan_shoot', input: { about: '$inputs.about', kind: '$inputs.kind', seconds: '$inputs.seconds', shape: '$inputs.shape', where: '$inputs.where', people: '$inputs.people', date: '$inputs.date' } }],
      result: ['plan'],
      next: [
        { id: 'video.caption', why: 'After you film and edit it: captions, word by word.' },
        { id: 'video.thumbnail', why: 'Then its thumbnail, from a frame of the video.' },
      ],
    },
  ],
};
