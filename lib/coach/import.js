// Coach import (behind COACH_IMPORT=off|admins|on, default off): a coach brings what they already have.
//
//   reviews    a CSV of client reviews or testimonials -> coach.reviews, shown on their site
//   programs   a CSV of workouts, one row per exercise -> coach programs (weeks -> days -> exercises)
//
// The column names are matched loosely so an export from Google Sheets, Excel, Trainerize, TrueCoach or FitBudd
// usually works as is ("Exercise Name", "Workout", "Rep Range", "Testimonial", "Stars"...). Nothing is saved until the
// coach sees the preview and confirms. No client accounts are made from a file: clients join with their own consent.

const coach = require('./index');
const db = require('../db');

const MAX_BYTES = 150 * 1024;
const MAX_REVIEWS = 30;

function setting() {
  const v = String(process.env.COACH_IMPORT || '').trim().toLowerCase();
  return v === 'on' || v === 'true' ? 'on' : v === 'admins' ? 'admins' : 'off';
}
function visibleTo(user) {
  const v = setting();
  return v === 'on' || (v === 'admins' && require('../harness/flags').admin(user));
}

// RFC 4180-ish: quotes, doubled quotes, commas, semicolons or tabs (whichever the header line uses most), CRLF.
function parseCsv(input) {
  let s = String(input || '').replace(/^﻿/, '');
  if (!s.trim()) return [];
  const first = s.split(/\r?\n/, 1)[0];
  const count = (ch) => first.split(ch).length - 1;
  const sep = [',', ';', '\t'].sort((a, b) => count(b) - count(a))[0];
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"' && cell === '') q = true;
    else if (ch === sep) { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some(Boolean));
}

const norm = (h) => String(h || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const COLS = {
  name: ['name', 'client', 'client name', 'author', 'reviewer', 'customer', 'full name', 'first name', 'from'],
  quote: ['quote', 'review', 'testimonial', 'text', 'comment', 'comments', 'feedback', 'body', 'message', 'what they said'],
  rating: ['rating', 'stars', 'star rating', 'score'],
  result: ['result', 'results', 'outcome', 'headline', 'title', 'transformation'],
  program: ['program', 'program name', 'plan', 'plan name', 'template', 'phase'],
  week: ['week', 'week number', 'wk'],
  day: ['day', 'workout', 'workout name', 'session', 'day name', 'session name', 'training day'],
  exercise: ['exercise', 'exercise name', 'movement', 'lift', 'exercise title'],
  sets: ['sets', 'set', 'number of sets', 'no of sets'],
  reps: ['reps', 'rep', 'rep range', 'repetitions', 'reps per set', 'target reps'],
  rest: ['rest', 'rest time', 'rest period', 'rest seconds', 'rest sec'],
  note: ['note', 'notes', 'instructions', 'coach notes', 'cues', 'tempo', 'rpe', 'description'],
};
function columns(header) {
  const h = header.map(norm);
  const out = {};
  for (const [k, names] of Object.entries(COLS)) {
    const i = h.findIndex((x) => names.includes(x));
    if (i >= 0) out[k] = i;
  }
  return out;
}

// What the file looks like: 'programs' with an exercise column, 'reviews' with a quote column, else null.
function detect(cols) {
  if (cols.exercise != null) return 'programs';
  if (cols.quote != null) return 'reviews';
  return null;
}

function readReviews(rows, cols) {
  const at = (r, k) => (cols[k] != null ? String(r[cols[k]] || '').trim() : '');
  const skipped = [];
  const items = [];
  rows.forEach((r, i) => {
    const quote = coach.block(at(r, 'quote'), 600).replace(/^["“]+|["”]+$/g, '');
    if (quote.length < 8) { skipped.push({ line: i + 2, why: 'no review text' }); return; }
    const stars = parseFloat(at(r, 'rating'));
    items.push({
      name: coach.text(at(r, 'name'), 60) || 'Client',
      quote,
      rating: Number.isFinite(stars) && stars > 0 ? Math.min(5, Math.round(stars)) : null,
      result: coach.text(at(r, 'result'), 80),
    });
  });
  return { items: items.slice(0, MAX_REVIEWS), skipped, cut: Math.max(0, items.length - MAX_REVIEWS) };
}

function readPrograms(rows, cols, fallbackName) {
  const at = (r, k) => (cols[k] != null ? String(r[cols[k]] || '').trim() : '');
  const skipped = [];
  const progs = new Map();
  let lastDay = 'Day 1';
  rows.forEach((r, i) => {
    const ex = at(r, 'exercise');
    if (!ex) { skipped.push({ line: i + 2, why: 'no exercise' }); return; }
    const pname = at(r, 'program') || fallbackName || 'Imported program';
    const wk = Math.max(1, Math.min(16, parseInt(at(r, 'week').replace(/\D+/g, ''), 10) || 1));
    const day = at(r, 'day') || lastDay;
    lastDay = day;
    if (!progs.has(pname)) progs.set(pname, new Map());
    const weeks = progs.get(pname);
    if (!weeks.has(wk)) weeks.set(wk, new Map());
    const days = weeks.get(wk);
    if (!days.has(day)) days.set(day, []);
    const restRaw = at(r, 'rest');
    days.get(day).push({ name: ex, sets: parseInt(at(r, 'sets'), 10) || 3, reps: at(r, 'reps') || '8-10', rest: /^\d+$/.test(restRaw) ? `${restRaw}s` : restRaw, note: at(r, 'note') });
  });
  const items = [...progs.entries()].slice(0, 10).map(([name, weeks]) => {
    const ordered = [...weeks.keys()].sort((a, b) => a - b).map((k) => ({ days: [...weeks.get(k).entries()].map(([title, exercises]) => ({ title, exercises })) }));
    const clean = coach.cleanWeeks(ordered);
    return { name: coach.text(name, 80), weeks: clean, days: clean.reduce((n, w) => n + w.days.length, 0), exercises: clean.reduce((n, w) => n + w.days.reduce((m, d) => m + d.exercises.length, 0), 0) };
  }).filter((p) => p.weeks.length);
  return { items, skipped };
}

// Reads a file's text. Returns { kind, items, skipped, cut, rows } or { error }.
function read(textIn, { kind, filename } = {}) {
  const raw = String(textIn || '');
  if (!raw.trim()) return { error: 'Pick a CSV file, or paste the rows.' };
  if (Buffer.byteLength(raw) > MAX_BYTES) return { error: 'That file is over 150 KB. Split it into smaller files.' };
  const rows = parseCsv(raw);
  if (rows.length < 2) return { error: 'We need a header row and at least one row under it.' };
  const cols = columns(rows[0]);
  const found = detect(cols);
  const want = kind === 'reviews' || kind === 'programs' ? kind : found;
  if (!want) return { error: 'We could not find a review column (like "Review" or "Testimonial") or an exercise column (like "Exercise"). Rename the column and try again.' };
  if (want === 'reviews' && cols.quote == null) return { error: 'This file has no review column. Name it "Review" or "Testimonial".' };
  if (want === 'programs' && cols.exercise == null) return { error: 'This file has no exercise column. Name it "Exercise".' };
  const base = String(filename || '').replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim();
  const out = want === 'reviews' ? readReviews(rows.slice(1), cols) : readPrograms(rows.slice(1), cols, base);
  if (!out.items.length) return { error: want === 'reviews' ? 'No reviews with text were found.' : 'No exercises were found.' };
  return { kind: want, rows: rows.length - 1, ...out };
}

async function saveReviews(c, items) {
  const keep = (c.reviews || []).filter((r) => r.source !== 'import');
  c.reviews = [...items.map((r) => ({ ...r, source: 'import' })), ...keep].slice(0, MAX_REVIEWS);
  await db.save(coach.COACHES, c);
  return { count: items.length };
}
async function savePrograms(c, items) {
  const saved = [];
  for (const p of items) {
    const out = await coach.saveProgram(c, null, { name: p.name, goal: 'Imported', weeks: p.weeks });
    if (out.program) saved.push(out.program);
  }
  return { count: saved.length, programs: saved };
}

module.exports = { setting, visibleTo, parseCsv, columns, read, saveReviews, savePrograms, MAX_BYTES, MAX_REVIEWS };
