// Studio's HyperFrames need ('motion'): off unless STUDIO_MOTION=on, and then only with a Chrome found.

const test = require('node:test');
const assert = require('assert');
const fs = require('fs');

test('motion: off without STUDIO_MOTION=on or a Chrome; on gives the CLI, browser and ffmpeg', () => {
  const needs = require('../lib/harness/needs');
  const was = { STUDIO_MOTION: process.env.STUDIO_MOTION, HYPERFRAMES_BROWSER_PATH: process.env.HYPERFRAMES_BROWSER_PATH, CHROME_PATH: process.env.CHROME_PATH };
  try {
    delete process.env.STUDIO_MOTION;
    needs._resetMotion();
    assert.strictEqual(needs.read('motion'), null);
    process.env.STUDIO_MOTION = 'on';
    process.env.HYPERFRAMES_BROWSER_PATH = '/nowhere/chrome';
    process.env.CHROME_PATH = '/nowhere/chrome';
    needs._resetMotion();
    const none = needs.motion();
    if (none) assert.ok(fs.existsSync(none.browser), 'only a Chrome that is really there');
    process.env.HYPERFRAMES_BROWSER_PATH = process.execPath; // any file that exists stands in for Chrome here
    needs._resetMotion();
    const m = needs.read('motion');
    if (Number(process.versions.node.split('.')[0]) < 22 || !needs.ffmpeg()) return assert.strictEqual(m, null);
    assert.ok(m && fs.existsSync(m.cli) && m.cli.endsWith('hyperframes.mjs'));
    assert.strictEqual(m.browser, process.execPath);
  } finally {
    for (const [k, v] of Object.entries(was)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    needs._resetMotion();
  }
});
