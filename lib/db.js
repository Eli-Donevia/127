// Tiny document store. Everything lives in memory and is written through to
// either Postgres (when DATABASE_URL is set, e.g. Replit's built-in database)
// or a local JSON file (data/db.json) for development.
//
// Collections: users, applications, wins, waitlist, leads, ideaTests, events, stripeEvents,
// billingReminders, billingRecords, retainedRecords (the last three are never trimmed:
// billing and consent records are kept for the membership plus 5 years, lib/billing-records.js),
// scorecards and circleRecaps (Founder's Circle, lib/circle.js), and drafts, tickets, reports,
// notes and circleQuestions (member operations, lib/member-ops.js).
// Run on a single instance (Replit "Reserved VM") so the in-memory cache stays authoritative.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = process.env.DB_FILE ? path.resolve(process.env.DB_FILE) : path.join(__dirname, '..', 'data', 'db.json');
const COLLECTIONS = ['users', 'applications', 'wins', 'waitlist', 'leads', 'ideaTests', 'events', 'stripeEvents', 'counters', 'billingReminders', 'billingRecords', 'retainedRecords', 'scorecards', 'circleRecaps', 'challenge', 'challengeSettings', 'drafts', 'tickets', 'reports', 'notes', 'circleQuestions', 'ageClosures'];

let store = Object.fromEntries(COLLECTIONS.map((c) => [c, {}]));
let pool = null;
let writeTimer = null;

async function init() {
  if (process.env.DATABASE_URL) {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
    });
    await pool.query(`CREATE TABLE IF NOT EXISTS docs (
      collection text NOT NULL,
      id text NOT NULL,
      data jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (collection, id)
    )`);
    // Events are write-only analytics history: keep them in Postgres, not in memory.
    const { rows } = await pool.query("SELECT collection, id, data FROM docs WHERE collection <> 'events'");
    for (const r of rows) {
      if (!store[r.collection]) store[r.collection] = {};
      store[r.collection][r.id] = r.data;
    }
    console.log(`[db] postgres: loaded ${rows.length} documents`);
  } else {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    if (fs.existsSync(FILE)) {
      const loaded = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      store = { ...store, ...loaded };
    }
    console.log('[db] local file store at data/db.json (set DATABASE_URL to use Postgres)');
  }
}

function flushFile() {
  clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    fs.writeFileSync(FILE + '.tmp', JSON.stringify(store, null, 2));
    fs.renameSync(FILE + '.tmp', FILE);
  }, 100);
}

function id() {
  return crypto.randomBytes(9).toString('base64url');
}

function all(collection) {
  return Object.values(store[collection] || {});
}

function get(collection, docId) {
  return (store[collection] || {})[docId] || null;
}

function find(collection, predicate) {
  return all(collection).find(predicate) || null;
}

function filter(collection, predicate) {
  return all(collection).filter(predicate);
}

const MEMORY_EVENTS = 500;

async function save(collection, doc) {
  if (!doc.id) doc.id = id();
  if (!doc.createdAt) doc.createdAt = new Date().toISOString();
  doc.updatedAt = new Date().toISOString();
  store[collection][doc.id] = doc;
  if (collection === 'events') {
    const keys = Object.keys(store.events);
    for (const k of keys.slice(0, Math.max(0, keys.length - MEMORY_EVENTS))) delete store.events[k];
  }
  // Processed Stripe event ids (webhook de-duplication); Stripe stops retrying after 3 days.
  if (collection === 'stripeEvents') {
    const keys = Object.keys(store.stripeEvents);
    for (const k of keys.slice(0, Math.max(0, keys.length - 5000))) delete store.stripeEvents[k];
  }
  if (pool) {
    await pool.query(
      `INSERT INTO docs (collection, id, data, updated_at) VALUES ($1, $2, $3, now())
       ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [collection, doc.id, doc]
    );
  } else {
    flushFile();
  }
  return doc;
}

// Removes every event that mentions a member (account deletion).
async function purgeEvents(userId, email) {
  for (const [k, e] of Object.entries(store.events)) {
    const p = (e && e.payload) || {};
    if (p.userId === userId || (email && p.email === email)) delete store.events[k];
  }
  if (pool) {
    await pool.query(
      "DELETE FROM docs WHERE collection = 'events' AND (data->'payload'->>'userId' = $1 OR data->'payload'->>'email' = $2)",
      [userId, email || '']
    );
  } else flushFile();
}

async function remove(collection, docId) {
  delete store[collection][docId];
  if (pool) await pool.query('DELETE FROM docs WHERE collection = $1 AND id = $2', [collection, docId]);
  else flushFile();
}

module.exports = { init, all, get, find, filter, save, remove, purgeEvents, id };
