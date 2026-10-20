// Gets a voice-note transcript or rough notes ready for the ops desk's checklist writer: reads a
// transcript file (.txt, .vtt, .srt, .docx), drops timestamps, speaker labels and repeated words,
// and names the job from the first line when the member didn't. No AI.

const fs = require('fs');
const path = require('path');
const { views, text } = require('../../_kit');
const { assetText } = require('../lib/doc-text');

function clean(s) {
  return String(s || '')
    .replace(/^WEBVTT.*$/m, '')
    .replace(/^\d+\s*$/gm, '')
    .replace(/^\s*\d{1,2}:\d{2}(:\d{2})?([.,]\d+)?\s*-->.*$/gm, '')
    .replace(/^\s*[[(]?\d{1,2}:\d{2}(:\d{2})?[\])]?\s*/gm, '')
    .replace(/^\s*([Ss]peaker\s*\d+|[Mm]e|[A-Z][a-z]+(\s[A-Z][a-z]+)?)\s*:\s*/gm, '')
    .replace(/\b(\w+)(\s+\1\b)+/gi, '$1')
    .replace(/\b(um+|uh+|er+|erm|hmm+)\b[,.]?\s*/gi, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const OPENERS = /^(?:(?:okay|ok|alright|all right|right|so|oh|and|um|uh|well|yeah)[,\s]+)*(?:(?:the )?first thing[,:]?\s+|first off[,:]?\s+)?/i;

// Sentences one by one: drop "okay so" openers and the intro line that names the job, and join
// very short follow-ups ("Check it twice.") onto the step before, so each line is one step.
function steps(s) {
  const out = [];
  for (const line of String(s).split(/\n+/)) {
    for (let sent of line.split(/(?<=[.!?])\s+/)) {
      sent = sent.replace(OPENERS, '').trim();
      if (!sent) continue;
      if (/\b(this is )?how (we|i|you) (do|handle|run|make|set up|close|open|pack|ship)\b/i.test(sent) && !out.length) continue;
      sent = sent[0].toUpperCase() + sent.slice(1);
      const words = sent.split(/\s+/).length;
      if (out.length && words <= 5) out[out.length - 1] = `${out[out.length - 1].replace(/[.!?]+$/, '')}, ${sent[0].toLowerCase()}${sent.slice(1)}`;
      else out.push(sent);
    }
  }
  return out.join('\n');
}

// "Okay so this is how we do a fall cleanup, like the standard one" -> "Fall cleanup"
function jobOf(s) {
  const first = String(s || '').split(/[.\n]/).find((l) => l.trim()) || '';
  const m = first.replace(OPENERS, '').match(/\bhow (?:we|i|you) (?:do|handle|run|make|set up|close|open|pack|ship)\s+(?:a |an |the |our |my )?([^,.;]{3,50})/i);
  return m ? text.sentenceCase(m[1].trim()) : '';
}

module.exports = {
  name: 'admin.clean_notes',
  title: 'Tidy a voice note',
  description: 'Reads a voice-note transcript or rough notes (pasted, or a .txt, .vtt, .srt or Word file), drops timestamps, speaker labels and filler, and names the job, ready to turn into a checklist.',
  kind: 'code',
  risk: 'read',
  needs: [],
  credits: 0,
  input: {
    type: 'object',
    properties: {
      notes: { type: 'string', title: 'Transcript or notes', format: 'textarea', maxLength: 12000 },
      file: { type: 'string', format: 'asset', title: 'Or a transcript file', accept: '.txt,.md,.vtt,.srt,.docx' },
      task: { type: 'string', title: 'Which job?', maxLength: 120 },
    },
  },
  output: {
    type: 'object',
    properties: { task: { type: 'string' }, notes: { type: 'string' }, words: { type: 'integer' }, sample: { type: 'boolean' } },
    required: ['task', 'notes', 'words'],
  },
  async run(input, ctx) {
    let raw = String(input.notes || '');
    let sample = false;
    if (input.file) raw = `${raw}\n${(await assetText(ctx, input.file, { what: 'transcript' })).text || ''}`;
    if (!raw.trim()) {
      raw = fs.readFileSync(path.join(__dirname, '..', 'sample', 'voice-note.txt'), 'utf8');
      sample = true;
    }
    const tidy = clean(raw);
    const task = text.oneLine(input.task || '') || jobOf(tidy.replace(OPENERS, '')) || 'How we do the job';
    const notes = steps(tidy).slice(0, 6000);
    const words = (notes.match(/\S+/g) || []).length;
    ctx.log(`Tidied ${words} words for "${task}"`);
    return { task: text.clip(task, 120), notes, words, ...(sample ? { sample: true } : {}) };
  },
  view(out) {
    return views.blocks(views.sampleNote(out, 'This voice note'), views.metric('Job', out.task, `${out.words} words of notes`), views.copy('Tidied notes', out.notes));
  },
};
