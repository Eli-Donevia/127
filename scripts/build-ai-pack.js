#!/usr/bin/env node
// Builds the AI Pack's files (content/shop/packs.json, slug "ai") from the prompt library (content/prompts): one
// Markdown file per group with every prompt ready to paste, plus the project instructions that set any AI up as the
// business's operator. Output: content/shop/files/ai/ with a manifest.json lib/shop.js reads.
//
// The outreach group stays out of the paid pack: prompts that find and contact buyers wait for Legal's read on
// business-finding tools in paid products (L62).
//
//   node scripts/build-ai-pack.js          writes the files
//   node scripts/build-ai-pack.js --check  exits 1 if a file would change

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SRC = path.join(__dirname, '..', 'content', 'prompts');
const OUT = path.join(__dirname, '..', 'content', 'shop', 'files', 'ai');
const LEFT_OUT = ['outreach'];

function groupDoc(g, prompts) {
  const lines = [`# ${g.title}`, '', g.intro, ''];
  for (const p of prompts) {
    lines.push(`## ${p.title}`, '', `**Use it when:** ${p.when}`, '');
    if (p.variables && p.variables.length) {
      lines.push('**Fill in first:**', '');
      for (const v of p.variables) lines.push(`- \`{{${v.key}}}\`: ${v.label}${v.example ? ` (for example: ${String(v.example).replace(/\n/g, ' / ')})` : ''}`);
      lines.push('');
    }
    lines.push('```text', p.prompt.trim(), '```', '');
    if (p.example && p.example.youGet) lines.push(`**What you get back:** ${p.example.youGet}`, '');
    if (p.tools && p.tools.length) lines.push(`**Works in:** ${p.tools.join(', ')}`, '');
  }
  return `${lines.join('\n').trim()}\n`;
}

function files() {
  const m = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'));
  const byId = new Map(m.prompts.map((p) => [p.id, p]));
  const out = [];
  const harness = fs.readFileSync(path.join(SRC, 'harness.txt'), 'utf8').trim();
  out.push({
    id: 'operator-instructions',
    title: 'Operator instructions (paste once into a Claude Project or ChatGPT custom instructions)',
    file: '00-operator-instructions.md',
    summary: 'Sets your AI up as the operator of your business, so every prompt after it starts from your context.',
    text: `# Operator instructions\n\nPaste this once into a Claude Project's instructions, a ChatGPT custom GPT or Gemini Gem, then add your business details where it asks. Every prompt in this pack works better after it.\n\n\`\`\`text\n${harness}\n\`\`\`\n`,
  });
  let n = 1;
  for (const g of m.groups) {
    if (LEFT_OUT.includes(g.id)) continue;
    const prompts = g.prompts.map((id) => byId.get(id)).filter(Boolean);
    if (!prompts.length) continue;
    const file = `${String(n).padStart(2, '0')}-${g.id}.md`;
    n += 1;
    out.push({ id: `prompts-${g.id}`, title: g.title.split(':')[0], file, summary: `${prompts.length} prompts. ${g.intro.split('. ')[0].replace(/\.$/, '')}.`, text: groupDoc(g, prompts) });
  }
  return out;
}

function readme(list) {
  const count = list.slice(1).reduce((k, f) => k + (f.text.match(/^## /gm) || []).length, 0);
  return `# 127 AI Pack

${count} prompts for running a small business with AI, grouped by job, plus the operator instructions that make any AI
start from your business instead of from zero.

1. Open 00-operator-instructions.md and paste it into a Claude Project (or ChatGPT custom GPT, or Gemini Gem) once.
2. Pick the file for the job in front of you. Fill in the {{blanks}}, paste, and send.
3. Paste the answer back in and ask for the next step. Each prompt ends with what to do next.

${list.map((f) => `- ${f.file}: ${f.title}`).join('\n')}

These prompts are yours to use in your own business and for your clients. Please don't resell or share the pack itself.
`;
}

function build({ check = false } = {}) {
  const list = files();
  const want = new Map(list.map((f) => [f.file, f.text]));
  want.set('README.md', readme(list));
  const manifest = list.map((f) => ({ id: f.id, title: f.title, summary: f.summary, file: f.file, bytes: Buffer.byteLength(f.text), sha256: crypto.createHash('sha256').update(f.text).digest('hex') }));
  want.set('manifest.json', `${JSON.stringify(manifest, null, 1)}\n`);
  const stale = [...want].filter(([name, data]) => !fs.existsSync(path.join(OUT, name)) || fs.readFileSync(path.join(OUT, name), 'utf8') !== data).map(([x]) => x);
  if (!check) {
    fs.mkdirSync(OUT, { recursive: true });
    for (const [name, data] of want) fs.writeFileSync(path.join(OUT, name), data);
  }
  return { stale: check ? stale : [], list };
}

if (require.main === module) {
  const check = process.argv.includes('--check');
  const r = build({ check });
  if (check && r.stale.length) {
    console.error(`AI Pack is out of date: ${r.stale.join(', ')}. Run node scripts/build-ai-pack.js`);
    process.exit(1);
  }
  console.log(check ? 'AI Pack is current.' : `Wrote ${r.list.length} files to content/shop/files/ai`);
}

module.exports = { build };
