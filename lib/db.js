// Tiny document store. Everything lives in memory and is written through to
// either Postgres (when DATABASE_URL is set, e.g. Replit's built-in database)
// or a local JSON file (data/db.json) for development.
//
// Collections: users, applications, wins, waitlist, leads, ideaTests, events, stripeEvents,
// billingReminders, billingRecords, retainedRecords (the last three are never trimmed:
// billing and consent records are kept for the membership plus 5 years, lib/billing-records.js),
// scorecards and circleRecaps (Founder's Circle, lib/circle.js), and drafts, tickets, reports,
// notes and circleQuestions (member operations, lib/member-ops.js), and hqConnections (127 HQ's saved
// keys and 127 links, one per member, doc id = user id, lib/hq.js), and prospectRuns (First 25 lists, deleted after
// 30 days, lib/first25.js), and doorRuns (front door results, their files and output as blobs, deleted after 30 days,
// lib/doors.js). The harness (lib/harness) keeps runs, inbox, pipeline, assets (file
// details; the bytes are blobs, below), brains, credits, harnessCache, actions (the daily counts on
// Today), schedules (autopilot), proof (wins a member logged, each with its consent record) and
// agreements (a member's OK to a business search's Terms line, taken in HQ, Legal L67).
// brainDocs and brainLog: a member's Brain docs, decisions and logged numbers (lib/harness/docs.js);
// activity: the Activity log, shared with Hub's connector rows (lib/harness/activity.js, connectors/log.js);
// boards: custom dashboards (Hub); agentChats: Ask 127 (lib/harness/agent.js);
// team: the AI team's role cards (lib/harness/team.js).
// foundingFive: Founding Five applications and the five's weeks (lib/founding-five.js); their videos are blobs.
// Blobs: file bytes for the harness Library, in a blobs table (Postgres) or data/blobs/ (local),
// never loaded into memory with the documents. The table is created on first use.
// Run on a single instance (Replit "Reserved VM") so the in-memory cache stays authoritative.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = process.env.DB_FILE ? path.resolve(process.env.DB_FILE) : path.join(__dirname, '..', 'data', 'db.json');
// packPurchases: one-time pack purchases (lib/shop.js), doc id = the Checkout Session id. Never trimmed (billing records).
const COLLECTIONS = ['users', 'applications', 'wins', 'waitlist', 'leads', 'ideaTests', 'events', 'stripeEvents', 'counters', 'billingReminders', 'billingRecords', 'retainedRecords', 'scorecards', 'circleRecaps', 'challenge', 'challengeSettings', 'drafts', 'tickets', 'reports', 'notes', 'circleQuestions', 'ageClosures', 'hqConnections', 'prospectRuns', 'doorRuns', 'runs', 'inbox', 'pipeline', 'assets', 'brains', 'credits', 'harnessCache', 'actions', 'schedules', 'proof', 'agreements', 'foundingFive', 'activity', 'boards', 'brainDocs', 'brainLog', 'agentChats', 'team', 'siteChats', 'siteChatSettings', 'packPurchases'];

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

// ---------- blobs ----------

const BLOB_DIR = process.env.BLOB_DIR ? path.resolve(process.env.BLOB_DIR) : path.join(path.dirname(FILE), 'blobs');
const blobName = (blobId) => String(blobId).replace(/[^A-Za-z0-9_-]/g, '');
let blobTable = null;

function blobsReady() {
  if (!blobTable) {
    blobTable = pool.query('CREATE TABLE IF NOT EXISTS blobs (id text PRIMARY KEY, data bytea NOT NULL, created_at timestamptz NOT NULL DEFAULT now())').catch((err) => {
      blobTable = null;
      throw err;
    });
  }
  return blobTable;
}

async function putBlob(blobId, buf) {
  const name = blobName(blobId);
  if (!name) throw new Error('bad blob id');
  if (pool) {
    await blobsReady();
    await pool.query('INSERT INTO blobs (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data', [name, buf]);
  } else {
    fs.mkdirSync(BLOB_DIR, { recursive: true });
    fs.writeFileSync(path.join(BLOB_DIR, name), buf);
  }
}

async function getBlob(blobId) {
  const name = blobName(blobId);
  if (!name) return null;
  if (pool) {
    await blobsReady();
    const { rows } = await pool.query('SELECT data FROM blobs WHERE id = $1', [name]);
    return rows.length ? rows[0].data : null;
  }
  const file = path.join(BLOB_DIR, name);
  return fs.existsSync(file) ? fs.readFileSync(file) : null;
}

async function removeBlob(blobId) {
  const name = blobName(blobId);
  if (!name) return;
  if (pool) {
    await blobsReady();
    await pool.query('DELETE FROM blobs WHERE id = $1', [name]);
  } else {
    fs.rmSync(path.join(BLOB_DIR, name), { force: true });
  }
}

module.exports = { init, all, get, find, filter, save, remove, purgeEvents, id, putBlob, getBlob, removeBlob };
