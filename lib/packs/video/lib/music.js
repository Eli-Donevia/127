// A short, quiet music bed made in code (no samples, nothing licensed): a soft pad on a four-chord
// loop, a light kick and a hat, at a steady tempo so scene cuts land on the beat. 48 kHz stereo WAV.

const NOTES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const KEYS = ['C', 'D', 'E', 'F', 'G', 'A'];

function freq(semitonesFromA4) {
  return 440 * 2 ** (semitonesFromA4 / 12);
}

// seconds: length; seed: picks the key; bpm: tempo. Returns { wav: Buffer, beat: seconds per beat }.
function musicBed(seconds, { seed = 0, bpm = 100, level = 0.22 } = {}) {
  const rate = 48000;
  const n = Math.ceil(seconds * rate);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const beat = 60 / bpm;
  const key = NOTES[KEYS[Math.abs(seed) % KEYS.length]];
  // I V vi IV, as semitones from the key's root, one chord per bar of 4 beats
  const chords = [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]];
  const root = key - 21; // around A3 to D4
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const bar = Math.floor(t / (beat * 4));
    const chord = chords[bar % chords.length];
    const inBar = (t % (beat * 4)) / (beat * 4);
    const swell = Math.min(1, inBar * 6) * (1 - 0.25 * inBar);
    let pad = 0;
    for (const s of chord) {
      const f = freq(root + s);
      pad += Math.sin(2 * Math.PI * f * t) * 0.5 + Math.sin(2 * Math.PI * f * 2.003 * t) * 0.12;
    }
    pad *= 0.11 * swell;
    const bass = Math.sin(2 * Math.PI * freq(root + chord[0] - 12) * t) * 0.16 * swell;
    // kick on beats 1 and 3, ducking the pad a little
    const tb = t % (beat * 2);
    const kick = tb < 0.25 ? Math.sin(2 * Math.PI * (48 + 90 * Math.exp(-tb * 30)) * tb) * Math.exp(-tb * 13) * 0.55 : 0;
    const duck = tb < 0.3 ? 0.55 + 0.45 * (tb / 0.3) : 1;
    // hat on the off-beats
    const th = (t + beat / 2) % beat;
    const hat = th < 0.05 ? (Math.random() * 2 - 1) * Math.exp(-th * 90) * 0.06 : 0;
    const fade = Math.min(1, t / 0.6, (seconds - t) / 1.2);
    const m = ((pad + bass) * duck + kick) * level * Math.max(0, fade);
    L[i] = m + hat * level;
    R[i] = m * 0.97 + hat * level * 0.6;
  }
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(L[i] * 32767))), 44 + i * 4);
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(R[i] * 32767))), 46 + i * 4);
  }
  return { wav: buf, beat };
}

module.exports = { musicBed };
