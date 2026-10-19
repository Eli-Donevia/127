// The pack's sample material: a demo business (Bright Path Tutoring, Columbus), a 2 minute 20 second
// talk with word timings (sample/talk.json), and its voice, spoken by ffmpeg's built-in flite voice
// so the sample clips have real sound that lines up with their captions. Everything here is labelled
// sample wherever it shows up.

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { brain, media } = require('../../_kit');
const { flatten } = require('./words');

const TALK = require('../sample/talk.json');
const BRAIN = require('../sample/brain.json');
const SITE = require('../sample/site.json');

const TALK_WORDS = flatten(TALK.words);

// Facts about the member's business for copy. In a sample run with nothing known, the demo business
// stands in (marked sampleBiz) so the outputs still read like a real one.
function bizOf(ctx, input = {}) {
  const b = brain.brainOf(ctx, input);
  const known = !!(b.name || b.what || b.offer);
  if (!known && ctx && ctx.sample) {
    const s = brain.brainOf({ brain: BRAIN, member: { firstName: TALK.speaker } }, input);
    return { ...s, firstName: TALK.speaker, sampleBiz: true };
  }
  return { ...b, firstName: b.firstName || '', sampleBiz: false };
}

// The business name to show, or the member's first name, or a neutral stand-in.
function displayName(b) {
  return b.name || (b.firstName ? `${b.firstName}` : 'Your business');
}

function talkWords(start = 0, end = Infinity) {
  return TALK_WORDS.filter((x) => x.s >= start - 0.001 && x.s < end);
}

// A shared cache folder for this server process: downloaded sources and the sample voice track.
// Files older than 12 hours are cleared when it's opened.
function cacheDir() {
  const dir = path.join(os.tmpdir(), '127-video-cache');
  fs.mkdirSync(dir, { recursive: true });
  const now = Date.now();
  if (!cacheDir.swept || now - cacheDir.swept > 10 * 60 * 1000) {
    cacheDir.swept = now;
    try {
      for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        try {
          if (now - fs.statSync(p).mtimeMs > 12 * 3600 * 1000) fs.rmSync(p, { recursive: true, force: true });
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
  }
  return dir;
}

function wavHeader(samples, rate = 16000) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + samples * 2, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(samples * 2, 40);
  return h;
}

let building = null;
// The sample talk as one WAV (16 kHz mono), each sentence spoken by flite and placed at its time.
// Cached for the process. Returns the path, or null when this ffmpeg has no flite voice.
async function talkAudio(ctx) {
  if (!media.hasFilter('flite')) return null;
  const key = crypto.createHash('sha1').update(JSON.stringify(TALK.sentences)).digest('hex').slice(0, 12);
  const file = path.join(cacheDir(), `talk-${key}.wav`);
  if (fs.existsSync(file)) {
    const now = new Date();
    try {
      fs.utimesSync(file, now, now);
    } catch {
      /* ignore */
    }
    return file;
  }
  if (!building) {
    building = (async () => {
      const rate = 16000;
      const total = Math.ceil((TALK.duration + 1) * rate);
      const pcm = Buffer.alloc(total * 2);
      const dir = media.scratch(ctx, 'talk');
      for (let i = 0; i < TALK.sentences.length; i++) {
        const s = TALK.sentences[i];
        const tf = path.join(dir, `l${i}.txt`);
        fs.writeFileSync(tf, s.t);
        const { stdout } = await media.ffmpeg(['-f', 'lavfi', '-i', `flite=textfile=${media.filterPath(tf)}:voice=${TALK.voice}`, '-ar', String(rate), '-ac', '1', '-f', 's16le', '-'], { timeoutSec: 60 });
        const at = Math.round(s.s * rate) * 2;
        stdout.copy(pcm, at, 0, Math.min(stdout.length, pcm.length - at));
      }
      const tmp = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, Buffer.concat([wavHeader(total, rate), pcm]));
      fs.renameSync(tmp, file);
      return file;
    })().finally(() => {
      building = null;
    });
  }
  return building;
}

module.exports = { TALK, BRAIN, SITE, TALK_WORDS, bizOf, displayName, talkWords, talkAudio, cacheDir };
