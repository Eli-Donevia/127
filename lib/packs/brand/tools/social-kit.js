// Profile picture (1080, safe for the circle crop), five story highlight covers (1080 x 1920) and
// bios that fit Instagram (150, published limit), TikTok and Facebook (no published limit, so we
// keep them short and say so). Uses the logo concept the member picked.

const { views, save, files, text } = require('../../_kit');
const { specFrom, png, conceptFrom } = require('../lib/kit');
const S = require('../lib/social');
const V = require('../lib/voice');

module.exports = {
  name: 'brand.social_kit',
  title: 'Social profile kit',
  description: 'Makes a 1080 profile picture from the chosen logo, five story highlight covers and Instagram, TikTok and Facebook bios that fit each platform.',
  kind: 'code',
  risk: 'draft',
  needs: [],
  wants: ['render'],
  credits: 3,
  timeoutSec: 180,
  input: {
    type: 'object',
    properties: {
      name: { type: 'string', title: 'Business name', maxLength: 60 },
      what: { type: 'string', title: 'What you sell', maxLength: 200 },
      city: { type: 'string', title: 'City (optional)', maxLength: 80 },
      color: { type: 'string', title: 'A color or a mood (optional)', maxLength: 20 },
      concept: { title: 'Logo concept', description: 'monogram, mark, wordmark, icon, seal or stacked, or the picked concept' },
      palette: { title: 'Colors from the palette step' },
      voice: { title: 'Voice from the voice step' },
    },
    required: ['name'],
  },
  output: { type: 'object', properties: { bios: { type: 'array' }, profile: { type: ['object', 'null'] }, zip: { type: 'object' } }, required: ['bios'] },
  async run(input, ctx) {
    const spec = specFrom(input, ctx);
    if (!spec.name) throw new Error('Add your business name first.');
    const conceptId = conceptFrom(input.concept, 'monogram');
    const voice = input.voice && input.voice.voice ? input.voice.voice : null;
    const bios = voice && Array.isArray(voice.bios) ? voice.bios : V.templateVoice({ name: spec.name, label: spec.descriptor.toLowerCase(), cityShort: String(spec.city || '').split(',')[0].trim(), firstName: spec.firstName, promise: spec.niche.promise, result: spec.niche.result, pain: spec.niche.pain, tone: 'friendly' }).bios;
    const base = text.slug(spec.name, 30) || 'brand';
    const profileSvg = S.profileSvg(spec, conceptId);
    const entries = [{ name: `${base}-profile.svg`, data: profileSvg }];
    const profilePng = await png(ctx, profileSvg, { width: 1080 });
    if (profilePng) entries.push({ name: `${base}-profile.png`, data: profilePng });
    for (const [i, c] of S.COVERS.entries()) {
      const s = S.coverSvg(spec, c, i);
      entries.push({ name: `${base}-highlight-${c.key}.svg`, data: s });
      const p = await png(ctx, s, { width: 1080 });
      if (p) entries.push({ name: `${base}-highlight-${c.key}.png`, data: p });
    }
    entries.push({ name: 'bios.txt', data: bios.map((b) => `${b.label} ${b.field.toLowerCase()} (${b.chars} characters${b.limit ? `, limit ${b.limit}` : `, no published limit, kept under ${b.target}`}):\n${b.text}\n`).join('\n') });
    const profile = profilePng ? await save.saveFile(ctx, save.fileName(spec.name, 'profile-picture', '.png'), profilePng) : null;
    const zip = await save.saveFile(ctx, save.fileName(spec.name, 'social-kit', '.zip'), files.zip(entries));
    ctx.log(`Made the profile picture, ${S.COVERS.length} highlight covers and ${bios.length} bios`);
    return { bios, concept: conceptId, profile, zip, covers: S.COVERS.map((c) => c.label) };
  },
  view(out) {
    return views.blocks(
      out.profile ? views.image(out.profile, 'Profile picture, safe for the circle crop') : null,
      ...out.bios.map((b) => views.copy(`${b.label} ${b.field.toLowerCase()} (${b.chars}${b.limit ? ` of ${b.limit}` : `, kept under ${b.target}`})`, b.text)),
      views.text(`Highlight covers: ${out.covers.join(', ')}. Upload each one as a story, then add it to a highlight with that name.`),
      views.file(out.zip, 'Social kit: profile picture, highlight covers and bios')
    );
  },
};
