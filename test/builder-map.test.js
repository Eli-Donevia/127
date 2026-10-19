// The Builder map (lib/builder-map.js): everything in Builder on one picture, drawn from the product itself.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const map = require('../lib/builder-map');
const { resources } = require('../content/resources.json');
const { TOOLS } = require('../lib/ai');
const { PLANS } = require('../lib/plans');
const { check } = require('../lib/copy-check');

test('the map shows every playbook and AI tool in Builder, and its line uses only offer.md\'s numbers (Legal 05 rule 6)', () => {
  const { nodes } = map.graph();
  const labels = (kind) => nodes.filter((n) => n.kind === kind).map((n) => n.label).sort();
  assert.deepStrictEqual(labels('item'), resources.map((r) => r.title).sort());
  // "Ask Eli's Playbook" is the Eli's Playbook hub itself.
  assert.deepStrictEqual(labels('tool'), TOOLS.filter((t) => t.slug !== 'ask').map((t) => t.name).sort());
  assert.strictEqual(labels('week').length, 4);
  assert.strictEqual(map.countLine(), `${resources.length} playbooks, worksheets and tools. Every AI tool. About ${PLANS.builder.aiRunsPerMonth} AI messages a month. All 4 weeks.`);
});

test('each AI tool links to the playbooks it works from', () => {
  const { edges } = map.graph();
  for (const t of TOOLS.filter((x) => x.slug !== 'ask')) {
    const linked = edges.filter((e) => e.kind === 'pair' && e.a === `t-${t.slug}`).map((e) => e.b.slice(2));
    assert.ok(linked.length, `${t.name} links to a playbook`);
    for (const s of linked) assert.ok(t.resources.includes(s), `${t.name} -> ${s}`);
  }
});

// Label boxes from the scene, with generous widths for Geist.
const boxes = (frame) => map.scene(frame).nodes.filter((n) => n.label).flatMap((n) => {
  const one = (text, px, dy, caps, ls) => {
    const w = text.length * (px * (caps ? 0.7 : 0.56) + (ls || 0));
    const x = n.x + n.label.dx;
    const x0 = n.label.anchor === 'end' ? x - w : n.label.anchor === 'middle' ? x - w / 2 : x;
    return { text, x0, x1: x0 + w, y0: n.y + dy - px * 0.8, y1: n.y + dy + px * 0.25 };
  };
  const t = n.label;
  return [one(t.text, t.px, t.dy, t.caps, t.ls), ...(t.sub ? [one(t.sub.text, t.sub.px, t.sub.dy, true, t.sub.ls)] : [])];
});

test('no two labels overlap, and every label stays inside its frame', () => {
  for (const frame of Object.keys(map.FRAMES)) {
    const { w, h } = map.FRAMES[frame];
    const b = boxes(frame);
    for (const x of b) assert.ok(x.x0 >= 0 && x.x1 <= w && x.y0 >= 0 && x.y1 <= h, `${frame}: "${x.text}" stays in the frame`);
    for (let i = 0; i < b.length; i++) {
      for (let j = i + 1; j < b.length; j++) {
        const p = b[i];
        const q = b[j];
        const hit = Math.min(p.x1, q.x1) > Math.max(p.x0, q.x0) && Math.min(p.y1, q.y1) > Math.max(p.y0, q.y0);
        assert.ok(!hit, `${frame}: "${p.text}" and "${q.text}" overlap`);
      }
    }
  }
});

test('the map says nothing a paid plan never says (Legal L62), and the pricing partial renders it', () => {
  const page = map.forPage();
  for (const s of [page.wide, page.phone]) assert.deepStrictEqual(check(s, { file: 'map.html', paid: true }), []);
  const html = ejs.render(fs.readFileSync(path.join(__dirname, '..', 'views', 'partials', 'builder-map.ejs'), 'utf8'), { builderMap: page });
  assert.strictEqual(html.match(/<svg /g).length, 2);
  assert.ok(html.includes(map.countLine()));
  // Two maps on one page keep their gradient ids apart.
  assert.ok(page.wide.includes('id="bm-wide-steel"') && page.phone.includes('id="bm-phone-steel"'));
});
