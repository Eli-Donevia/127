// Keys and connections a tool can ask for in `needs` (contract section 6). A tool reads only the
// keys it declared, through ctx.secret(name); when one is missing the tool runs in sample mode.
// Values come from the server's environment (127's own accounts). Never logged, never in output.

const { spawnSync } = require('child_process');

const env = (k) => (process.env[k] ? String(process.env[k]) : '');

let ffmpegPath;
function ffmpeg() {
  if (ffmpegPath === undefined) {
    const bin = env('FFMPEG_PATH') || 'ffmpeg';
    try {
      const r = spawnSync(bin, ['-version'], { timeout: 5000, stdio: 'ignore' });
      ffmpegPath = r.status === 0 ? bin : null;
    } catch {
      ffmpegPath = null;
    }
  }
  return ffmpegPath;
}

// name -> { label, read(): value or null }
const NEEDS = {
  // PLACES_API_KEY is the name the gym pack's setup note gave Eli and First 25 reads GOOGLE_PLACES_KEY; any of them works.
  places: { label: 'Google Places (127 account)', read: () => env('GOOGLE_PLACES_API_KEY') || env('PLACES_API_KEY') || env('GOOGLE_PLACES_KEY') || null },
  instagram: {
    label: 'Instagram Business Discovery (127 account)',
    read: () => (env('IG_ACCESS_TOKEN') && env('IG_USER_ID') ? { token: env('IG_ACCESS_TOKEN'), userId: env('IG_USER_ID') } : null),
  },
  youtube: { label: 'YouTube Data API (127 account)', read: () => env('YOUTUBE_API_KEY') || null },
  pexels: { label: 'Pexels stock video (127 account)', read: () => env('PEXELS_API_KEY') || null },
  voice: { label: 'Text to speech (127 account)', read: () => env('ELEVENLABS_API_KEY') || null },
  hunter: { label: 'Hunter email finder (127 account)', read: () => env('HUNTER_API_KEY') || null },
  transcribe: { label: 'Deepgram transcription (127 account)', read: () => env('DEEPGRAM_API_KEY') || null },
  gemini: { label: 'Google AI: images, music and short video (127 account)', read: () => env('GEMINI_API_KEY') || null },
  render: { label: 'Video rendering (ffmpeg on the server)', read: () => ffmpeg() },
  // The member's own HQ connections. Not wired into packs yet: tools that need them run on sample data.
  stripe: { label: "The member's Stripe (HQ)", read: () => null },
  shopify: { label: "The member's Shopify (HQ)", read: () => null },
};

function known(name) {
  return Object.prototype.hasOwnProperty.call(NEEDS, name);
}

function available(name) {
  return known(name) && !!NEEDS[name].read();
}

function read(name) {
  return known(name) ? NEEDS[name].read() : null;
}

// For the admin page: which keys are set, never their values.
function status() {
  return Object.entries(NEEDS).map(([name, n]) => ({ name, label: n.label, ready: !!n.read() }));
}

module.exports = { NEEDS, known, available, read, status, ffmpeg, _resetFfmpeg: () => (ffmpegPath = undefined) };
