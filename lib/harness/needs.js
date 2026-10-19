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

// Legal L53, L66 and L67: a search of real businesses names its source and Terms Section 13B under the
// button that starts it, in First 25's words. HQ shows a source's line under Run it on any workflow with a
// step that needs or wants the source, while the source is on (engine.agreeLines). When the workflow may
// use Google and OpenStreetMap both, one line names both (AGREE_BOTH), never two.
const TERMS_13B = '/terms#13b-first-25';
const AGREE_BOTH = { text: "Business info from Google Maps and OpenStreetMap. By searching, you agree to our {terms}, including Google Maps' terms.", href: TERMS_13B };

// name -> { label, read(): value or null, agree?: { text, href } }
const NEEDS = {
  // PLACES_API_KEY is the name the gym pack's setup note gave Eli and First 25 reads GOOGLE_PLACES_KEY; any of them works.
  places: {
    label: 'Google Places (127 account)',
    read: () => env('GOOGLE_PLACES_API_KEY') || env('PLACES_API_KEY') || env('GOOGLE_PLACES_KEY') || null,
    agree: { text: "Business info from Google Maps. By searching, you agree to our {terms}, including Google Maps' terms.", href: TERMS_13B },
  },
  instagram: {
    label: 'Instagram Business Discovery (127 account)',
    read: () => (env('IG_ACCESS_TOKEN') && env('IG_USER_ID') ? { token: env('IG_ACCESS_TOKEN'), userId: env('IG_USER_ID') } : null),
  },
  youtube: { label: 'YouTube Data API (127 account)', read: () => env('YOUTUBE_API_KEY') || null },
  pexels: { label: 'Pexels stock video (127 account)', read: () => env('PEXELS_API_KEY') || null },
  // The same two servers First 25 reads; public OpenStreetMap servers are for testing only (Legal L53 part 2.4).
  osm: {
    label: 'OpenStreetMap servers (127 account)',
    read: () => (env('OSM_OVERPASS_URL') && env('OSM_NOMINATIM_URL') ? { overpass: env('OSM_OVERPASS_URL'), nominatim: env('OSM_NOMINATIM_URL') } : null),
    agree: { text: 'Business info from OpenStreetMap. By searching, you agree to our {terms}.', href: TERMS_13B },
  },
  voice: { label: 'Text to speech (127 account)', read: () => env('ELEVENLABS_API_KEY') || null },
  hunter: { label: 'Hunter email finder (127 account)', read: () => env('HUNTER_API_KEY') || null },
  transcribe: { label: 'Deepgram transcription (127 account)', read: () => env('DEEPGRAM_API_KEY') || null },
  gemini: { label: 'Google AI: images, music and short video (127 account)', read: () => env('GEMINI_API_KEY') || null },
  render: { label: 'Video rendering (ffmpeg on the server)', read: () => ffmpeg() },
  // The member's own HQ connections. Not wired into packs yet: tools that need them run on sample data.
  stripe: { label: "The member's Stripe (HQ)", read: () => null },
  shopify: { label: "The member's Shopify (HQ)", read: () => null },
};

// Outside services Legal hasn't cleared (Oct 19). None is in the Privacy Policy, and Legal clears each one
// before its key goes into production. Until its line here is removed, a key that is set is ignored: a tool
// that wants it uses labeled samples, one that needs it runs as a sample, and /admin says it waits for Legal.
const HELD = {
  youtube: { service: 'YouTube Data API', why: 'not in the Privacy Policy yet' },
  pexels: { service: 'Pexels', why: 'not in the Privacy Policy yet' },
  voice: { service: 'ElevenLabs', why: 'not in the Privacy Policy yet' },
  transcribe: { service: 'Deepgram', why: 'not in the Privacy Policy yet' },
  gemini: { service: 'Gemini', why: 'not in the Privacy Policy yet, and its free tier trains on what it is sent' },
  hunter: { service: 'Hunter', why: "not in the Privacy Policy yet, and it finds addresses beyond a business's own site (First 25 uses only published ones)" },
};

function known(name) {
  return Object.prototype.hasOwnProperty.call(NEEDS, name);
}

function held(name) {
  return Object.prototype.hasOwnProperty.call(HELD, name);
}

function available(name) {
  return known(name) && !held(name) && !!NEEDS[name].read();
}

function read(name) {
  return known(name) && !held(name) ? NEEDS[name].read() : null;
}

// The line a member reads before a live search of this source, or null.
function agreeOf(name) {
  return (known(name) && NEEDS[name].agree) || null;
}

// The lines for the sources a workflow's searches may use, each with the sources it covers: one line per
// source, except Google and OpenStreetMap together, which share AGREE_BOTH (Legal L67).
function agreeFor(names) {
  const list = [...new Set(names)].filter((n) => agreeOf(n)).sort();
  const both = list.includes('places') && list.includes('osm');
  const out = both ? [{ ...AGREE_BOTH, sources: ['osm', 'places'] }] : [];
  for (const n of list) if (!(both && (n === 'places' || n === 'osm'))) out.push({ ...agreeOf(n), sources: [n] });
  return out;
}

// For the admin page: which keys are set, never their values. A held one says it waits for Legal.
function status() {
  return Object.entries(NEEDS).map(([name, n]) =>
    held(name) ? { name, label: n.label, ready: false, held: `Waits for Legal: ${HELD[name].why}.`, keySet: !!n.read() } : { name, label: n.label, ready: !!n.read() }
  );
}

// The held services by name, for the HQ v2 card in /admin.
function heldList() {
  return Object.entries(HELD).map(([name, h]) => ({ name, service: h.service, why: h.why, keySet: !!NEEDS[name].read() }));
}

module.exports = { NEEDS, HELD, TERMS_13B, AGREE_BOTH, known, held, available, read, agreeOf, agreeFor, status, heldList, ffmpeg, _resetFfmpeg: () => (ffmpegPath = undefined) };
