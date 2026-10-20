// handyman.ad_line: what the member's state requires on the ads this pack makes (Legal L75). Asked once:
// whether the member holds a contractor license, kept in this pack's memory like the hourly rate. In
// California, Arizona and Nevada a member without one gets "Not a licensed contractor." on every ad
// (door hangers, offer card, offer sheet, flyer, site, Google profile kit): the kit tools print it from
// their license_line input. The state's banner (Oregon's CCB line on every ad workflow, Florida's and
// the others' for a member without a license) shows here, to the member. With a profile description,
// it returns the description ending with the line, to paste into Google.

const { text, views, time, brain } = require('../../_kit');
const T = require('../../_kit/home/tools');
const geo = require('../../_kit/home/geo');
const P = require('../lib/punch');

const MEMORY = 'licensed';
const ANSWERS = ['No', 'Yes'];
const PROFILE_MAX = 750; // Google's description limit (local pack data/gbp.json)
const STR = { type: 'string' };

const answerOf = (v) => {
  const s = String(v || '').trim().toLowerCase();
  if (/^(y|yes|true|licensed)$/.test(s)) return 'Yes';
  if (/^(n|no|false|not licensed)$/.test(s)) return 'No';
  return '';
};

// The rule for a place and answer: { code, name, licensed, line, banner, ask }. Pure: tests import it.
function adRule(code, licensed, today = '') {
  const st = P.stateOf(code, today);
  const out = { code: code || '', name: st ? st.name : '', licensed: licensed || '', line: '', banner: '', ask: '' };
  if (!st) return out;
  const unlicensed = licensed !== 'Yes';
  if (st.ad_line && unlicensed) out.line = st.ad_line;
  if (st.banner && (st.banner_always || unlicensed)) out.banner = st.banner;
  if (st.ad_line && !licensed) out.ask = `Do you hold a contractor license? Answer once and it is kept for next time. Until then your ads in ${st.name} say "${st.ad_line}"`;
  return out;
}

// The profile description ending with the line, inside Google's limit.
function withLine(description, line) {
  const d = text.plain(String(description || '')).trim();
  if (!d || !line || d.endsWith(line)) return d;
  return `${text.clip(d, PROFILE_MAX - line.length - 1)} ${line}`;
}

function adLineTool(cfg) {
  const id = cfg.id;
  return {
    name: `${id}.ad_line`,
    title: 'Your state\'s line for ads',
    description: 'Whether your state requires a line on your ads, like "Not a licensed contractor." in California, Arizona and Nevada, and the state\'s advertising rule. Asks once whether you hold a contractor license and keeps the answer.',
    kind: 'code',
    risk: 'draft',
    needs: [],
    credits: 0,
    timeoutSec: 10,
    input: {
      type: 'object',
      properties: {
        licensed: { type: 'string', enum: ANSWERS, title: 'Do you hold a contractor license?' },
        city: { type: 'string', maxLength: 80, title: 'City and state' },
        description: { type: 'string', maxLength: 2000, title: 'Google profile description (optional)' },
      },
    },
    output: {
      type: 'object',
      required: ['code', 'licensed', 'line', 'banner', 'ask'],
      properties: { code: STR, name: STR, licensed: STR, line: STR, banner: STR, ask: STR, description: STR },
    },
    async run(input, ctx) {
      const f = T.facts(ctx, cfg, input);
      const typed = answerOf(input.licensed);
      const kept = answerOf(brain.packMemory(ctx, id)[MEMORY]);
      if (typed && typed !== kept) await brain.remember(ctx, MEMORY, typed);
      // The place typed or kept, else the state in the member's business profile.
      const code = geo.parsePlace(f.place).state || geo.parsePlace(`x, ${f.b.region || ''}`).state || '';
      const out = adRule(code, typed || kept, time.today(ctx));
      if (input.description != null && String(input.description).trim()) out.description = withLine(input.description, out.line);
      return out;
    },
    view(out) {
      return views.blocks(
        out.banner ? views.text(out.banner) : null,
        out.line ? views.text(`Your ads from this workflow say "${out.line}"`) : null,
        out.ask ? views.text(out.ask) : null,
        out.description ? views.copy(out.line ? `Your Google profile description, ending with "${out.line}"` : 'Your Google profile description', out.description) : null,
      );
    },
  };
}

module.exports = { adLineTool, adRule, withLine, answerOf, MEMORY };
