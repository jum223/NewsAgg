const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// In production (Railway), use the mounted volume at /app/data for persistence.
// Locally, fall back to the project root.
const DB_PATH = process.env.NODE_ENV === 'production'
  ? '/app/data/data.db'
  : path.join(__dirname, '../data.db');

// Ensure the directory exists before opening the database
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// ─── Schema ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tokens (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    access_token TEXT,
    refresh_token TEXT,
    expiry_date INTEGER,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS digests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS fetched_message_ids (
    message_id TEXT PRIMARY KEY,
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ─── Sources ───────────────────────────────────────────────────

function getSources() {
  return db.prepare('SELECT * FROM sources ORDER BY created_at DESC').all();
}

function addSource(email, name) {
  const existing = db.prepare('SELECT * FROM sources WHERE email = ?').get(email);
  if (existing) throw new Error('Source already exists');
  const result = db.prepare('INSERT INTO sources (email, name) VALUES (?, ?)').run(email, name);
  return { id: result.lastInsertRowid, email, name };
}

function removeSource(id) {
  db.prepare('DELETE FROM sources WHERE id = ?').run(id);
}

// ─── Tokens ────────────────────────────────────────────────────

function saveTokens(tokens) {
  db.prepare(`
    INSERT OR REPLACE INTO tokens (id, access_token, refresh_token, expiry_date, updated_at)
    VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(tokens.access_token, tokens.refresh_token, tokens.expiry_date);
}

function getTokens() {
  return db.prepare('SELECT * FROM tokens WHERE id = 1').get();
}

// ─── Digests ───────────────────────────────────────────────────

function saveDigest(digest) {
  const date = new Date().toISOString().split('T')[0];
  db.prepare('INSERT INTO digests (date, content) VALUES (?, ?)').run(date, JSON.stringify(digest));
}

function getLatestDigest() {
  const row = db.prepare('SELECT * FROM digests ORDER BY created_at DESC LIMIT 1').get();
  if (!row) return null;
  return { ...row, content: JSON.parse(row.content) };
}

function getDigests() {
  return db.prepare('SELECT id, date, created_at FROM digests ORDER BY created_at DESC LIMIT 30').all();
}

function getDigest(id) {
  const row = db.prepare('SELECT * FROM digests WHERE id = ?').get(id);
  if (!row) return null;
  return { ...row, content: JSON.parse(row.content) };
}

// ─── Message tracking (avoid re-processing) ────────────────────

function isMessageFetched(messageId) {
  return !!db.prepare('SELECT 1 FROM fetched_message_ids WHERE message_id = ?').get(messageId);
}

function markMessageFetched(messageId) {
  db.prepare('INSERT OR IGNORE INTO fetched_message_ids (message_id) VALUES (?)').run(messageId);
}

module.exports = {
  getSources, addSource, removeSource,
  saveTokens, getTokens,
  saveDigest, getLatestDigest, getDigests, getDigest,
  isMessageFetched, markMessageFetched,
};
