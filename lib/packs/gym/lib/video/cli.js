#!/usr/bin/env node
'use strict';
/*
 * node cli.js --props <file.json> --out <file.mp4> [--poster <file.png>] [--ffmpeg <path>]
 *             [--tmp <dir>] [--preset veryfast] [--plan] [--keep-temp]
 * Prints the result JSON ({ video, poster, durationSec, template, warnings, ... }) on stdout.
 * --plan prints the plan (template, shots, warnings, ffmpeg args) without rendering.
 */

const fs = require('fs');
const path = require('path');
const { renderSpecReel, buildPlan } = require('./render');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next == null || next.startsWith('--')) out[key] = true;
    else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function usage(msg) {
  if (msg) process.stderr.write(`${msg}\n`);
  process.stderr.write('usage: node cli.js --props <file.json> --out <file.mp4> [--poster <file.png>] [--ffmpeg <path>] [--tmp <dir>] [--preset veryfast] [--plan]\n');
  process.exit(2);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) usage();
  if (!args.props || args.props === true) usage('missing --props');
  let props;
  try {
    props = JSON.parse(fs.readFileSync(path.resolve(String(args.props)), 'utf8'));
  } catch (err) {
    usage(`could not read props: ${err.message}`);
  }
  // Relative media paths in the props file are resolved against the props file's folder.
  const base = path.dirname(path.resolve(String(args.props)));
  const abs = (p) => (typeof p === 'string' && p && !path.isAbsolute(p) ? path.resolve(base, p) : p);
  if (props && typeof props === 'object') {
    if (Array.isArray(props.clips)) props.clips = props.clips.map(abs);
    if (Array.isArray(props.photos)) props.photos = props.photos.map(abs);
    if (props.music) props.music = abs(props.music);
    if (props.gym && props.gym.logo) props.gym.logo = abs(props.gym.logo);
  }
  if (args.plan) {
    const plan = buildPlan(props, { outPath: args.out ? path.resolve(String(args.out)) : 'reel.mp4' });
    const { ass, filter, ...rest } = plan;
    process.stdout.write(`${JSON.stringify(Object.assign(rest, { assBytes: ass.length }), null, 2)}\n`);
    return;
  }
  if (!args.out || args.out === true) usage('missing --out');
  const controller = new AbortController();
  process.on('SIGINT', () => controller.abort());
  process.on('SIGTERM', () => controller.abort());
  let last = -1;
  const res = await renderSpecReel(props, {
    outPath: path.resolve(String(args.out)),
    posterPath: args.poster && args.poster !== true ? path.resolve(String(args.poster)) : undefined,
    ffmpeg: args.ffmpeg && args.ffmpeg !== true ? String(args.ffmpeg) : 'ffmpeg',
    tmpDir: args.tmp && args.tmp !== true ? path.resolve(String(args.tmp)) : undefined,
    preset: args.preset && args.preset !== true ? String(args.preset) : undefined,
    keepTemp: !!args['keep-temp'],
    signal: controller.signal,
    onProgress: ({ phase, progress }) => {
      const pct = Math.floor(progress * 100);
      if (process.stderr.isTTY && pct !== last) {
        last = pct;
        process.stderr.write(`\r${phase} ${pct}%   `);
      }
    },
  });
  if (process.stderr.isTTY) process.stderr.write('\n');
  process.stdout.write(`${JSON.stringify(res, null, 2)}\n`);
}

main().catch((err) => {
  process.stderr.write(`${err && err.stack ? err.stack : err}\n`);
  process.exit(1);
});
