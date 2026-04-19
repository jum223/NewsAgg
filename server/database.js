const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

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
db.pragma('foreign_keys = ON');

// User-scoped tables: single source of truth for CREATE (bootstrap + legacy migration).
const USER_SCOPED_TABLES = [
  {
    name: 'sources',
    sql: `CREATE TABLE sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, email)
  );`,
  },
  {
    name: 'tokens',
    sql: `CREATE TABLE tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
    access_token TEXT,
    refresh_token TEXT,
    expiry_date INTEGER,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );`,
  },
  {
    name: 'digests',
    sql: `CREATE TABLE digests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    date TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );`,
  },
  {
    name: 'fetched_message_ids',
    sql: `CREATE TABLE fetched_message_ids (
    message_id TEXT NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id),
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (message_id, user_id)
  );`,
  },
  {
    name: 'weekly_digests',
    sql: `CREATE TABLE weekly_digests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    week_start TEXT NOT NULL,
    week_end TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );`,
  },
];

function userScopedBootstrapSql() {
  return USER_SCOPED_TABLES.map(({ sql }) => sql.replace(/^CREATE TABLE /, 'CREATE TABLE IF NOT EXISTS ')).join('\n');
}

function tableHasColumn(tableName, columnName) {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return rows.some((r) => r.name === columnName);
}

/** Recreate user-scoped tables left over from pre–multi-user schema (no user_id). */
function migrateLegacyUserScopedTables() {
  for (const { name, sql } of USER_SCOPED_TABLES) {
    const cols = db.prepare(`PRAGMA table_info(${name})`).all();
    if (cols.length === 0) continue;
    if (tableHasColumn(name, 'user_id')) continue;
    console.warn(
      `[database] Migrating legacy table "${name}": missing user_id column; dropping and recreating (data in this table will be lost)`
    );
    db.exec(`DROP TABLE IF EXISTS ${name}`);
    db.exec(sql);
  }
}

// ─── Schema ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    avatar_url TEXT,
    daily_cron_hour INTEGER DEFAULT 20,
    is_admin INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS invite_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    created_by INTEGER REFERENCES users(id),
    used_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    used_at DATETIME
  );

  ${userScopedBootstrapSql()}
`);

migrateLegacyUserScopedTables();

// ─── Story Ratings table ──────────────────────────────────────
// Created separately (not in USER_SCOPED_TABLES) because it has a composite
// unique key across user_id+story_id rather than just user_id.

db.exec(`
  CREATE TABLE IF NOT EXISTS story_ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id   TEXT NOT NULL,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    digest_id  INTEGER,
    rating     TEXT NOT NULL CHECK(rating IN ('up','down')),
    source     TEXT NOT NULL DEFAULT 'web' CHECK(source IN ('web','email')),
    story_topic   TEXT,
    story_source  TEXT,
    rated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE(story_id, user_id)
  );
`);

// ─── Migrations: additive column changes ──────────────────────
// Safe to run every startup — ALTER TABLE is a no-op if column exists is
// simulated via try/catch since SQLite has no IF NOT EXISTS for columns.

const columnMigrations = [
  { table: 'users',         column: 'flavor',         sql: "ALTER TABLE users ADD COLUMN flavor TEXT DEFAULT NULL" },
  { table: 'sources',       column: 'min_stories',    sql: "ALTER TABLE sources ADD COLUMN min_stories INTEGER DEFAULT 0" },
  { table: 'story_ratings', column: 'story_headline', sql: "ALTER TABLE story_ratings ADD COLUMN story_headline TEXT DEFAULT NULL" },
];

for (const { table, column, sql } of columnMigrations) {
  try {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!cols.some(c => c.name === column)) {
      db.exec(sql);
      console.log(`[database] Added column "${column}" to "${table}"`);
    }
  } catch (e) {
    // Column already exists or other benign error
  }
}

// ─── Users ────────────────────────────────────────────────────

function findUserByGoogleId(googleId) {
  return db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId);
}

function findUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

function findUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function createUser({ googleId, email, name, avatarUrl, isAdmin = false, flavor = null }) {
  const result = db.prepare(
    'INSERT INTO users (google_id, email, name, avatar_url, is_admin, flavor) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(googleId, email, name, avatarUrl, isAdmin ? 1 : 0, flavor);
  return findUserById(result.lastInsertRowid);
}

function updateUser(id, fields) {
  const allowed = ['name', 'avatar_url', 'daily_cron_hour', 'flavor'];
  const updates = [];
  const values = [];
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      updates.push(`${key} = ?`);
      values.push(fields[key]);
    }
  }
  if (updates.length === 0) return findUserById(id);
  values.push(id);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  return findUserById(id);
}

function getAllUsers() {
  return db.prepare('SELECT id, email, name, avatar_url, daily_cron_hour, is_admin, flavor, created_at FROM users').all();
}

function getUsersByDailyCronHour(hour) {
  return db.prepare('SELECT * FROM users WHERE daily_cron_hour = ?').all(hour);
}

// ─── Invite Codes ─────────────────────────────────────────────

function generateInviteCode(createdBy) {
  const code = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8-char code
  db.prepare('INSERT INTO invite_codes (code, created_by) VALUES (?, ?)').run(code, createdBy);
  return code;
}

function validateInviteCode(code) {
  return db.prepare('SELECT * FROM invite_codes WHERE code = ? AND used_by IS NULL').get(code);
}

function redeemInviteCode(code, userId) {
  db.prepare('UPDATE invite_codes SET used_by = ?, used_at = CURRENT_TIMESTAMP WHERE code = ? AND used_by IS NULL')
    .run(userId, code);
}

function getInviteCodes(createdBy) {
  // Admin sees all codes; otherwise only your own
  if (createdBy === null) {
    return db.prepare('SELECT ic.*, u.email AS used_by_email FROM invite_codes ic LEFT JOIN users u ON ic.used_by = u.id ORDER BY ic.created_at DESC').all();
  }
  return db.prepare(
    'SELECT ic.*, u.email AS used_by_email FROM invite_codes ic LEFT JOIN users u ON ic.used_by = u.id WHERE ic.created_by = ? ORDER BY ic.created_at DESC'
  ).all(createdBy);
}

// ─── Sources (user-scoped) ────────────────────────────────────

function getSources(userId) {
  return db.prepare('SELECT * FROM sources WHERE user_id = ? ORDER BY created_at DESC').all(userId);
}

function addSource(userId, email, name) {
  const existing = db.prepare('SELECT * FROM sources WHERE user_id = ? AND email = ?').get(userId, email);
  if (existing) throw new Error('Source already exists');
  const result = db.prepare('INSERT INTO sources (user_id, email, name) VALUES (?, ?, ?)').run(userId, email, name);
  return { id: result.lastInsertRowid, user_id: userId, email, name };
}

function removeSource(userId, id) {
  db.prepare('DELETE FROM sources WHERE id = ? AND user_id = ?').run(id, userId);
}

function updateSource(userId, id, fields) {
  const allowed = ['min_stories'];
  const updates = [];
  const values = [];
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      updates.push(`${key} = ?`);
      values.push(fields[key]);
    }
  }
  if (updates.length === 0) return;
  values.push(id, userId);
  db.prepare(`UPDATE sources SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);
}

// ─── Tokens (user-scoped) ─────────────────────────────────────

function saveTokens(userId, tokens) {
  db.prepare(`
    INSERT INTO tokens (user_id, access_token, refresh_token, expiry_date, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      access_token = excluded.access_token,
      refresh_token = COALESCE(excluded.refresh_token, tokens.refresh_token),
      expiry_date = excluded.expiry_date,
      updated_at = CURRENT_TIMESTAMP
  `).run(userId, tokens.access_token, tokens.refresh_token, tokens.expiry_date);
}

function getTokens(userId) {
  return db.prepare('SELECT * FROM tokens WHERE user_id = ?').get(userId);
}

// ─── Digests (user-scoped) ────────────────────────────────────

function saveDigest(userId, digest) {
  const date = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const result = db.prepare('INSERT INTO digests (user_id, date, content) VALUES (?, ?, ?)').run(userId, date, JSON.stringify(digest));
  return { id: result.lastInsertRowid };
}

function getLatestDigest(userId) {
  const row = db.prepare('SELECT * FROM digests WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(userId);
  if (!row) return null;
  return { ...row, content: JSON.parse(row.content) };
}

function getDigests(userId) {
  return db.prepare('SELECT id, date, created_at FROM digests WHERE user_id = ? ORDER BY created_at DESC LIMIT 30').all(userId);
}

function getDigest(userId, id) {
  const row = db.prepare('SELECT * FROM digests WHERE id = ? AND user_id = ?').get(id, userId);
  if (!row) return null;
  return { ...row, content: JSON.parse(row.content) };
}

// ─── Weekly Digests (user-scoped) ─────────────────────────────

function getRecentDailyDigests(userId, days = 7) {
  const cutoff = (() => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  })();
  return db.prepare(
    'SELECT content FROM digests WHERE user_id = ? AND date >= ? ORDER BY date ASC'
  ).all(userId, cutoff).map(r => JSON.parse(r.content));
}

function saveWeeklyDigest(userId, weekStart, weekEnd, digest) {
  db.prepare(
    'INSERT INTO weekly_digests (user_id, week_start, week_end, content) VALUES (?, ?, ?, ?)'
  ).run(userId, weekStart, weekEnd, JSON.stringify(digest));
}

function getLatestWeeklyDigest(userId) {
  const row = db.prepare('SELECT * FROM weekly_digests WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(userId);
  if (!row) return null;
  return { ...row, content: JSON.parse(row.content) };
}

function getWeeklyDigests(userId) {
  return db.prepare(
    'SELECT id, week_start, week_end, created_at FROM weekly_digests WHERE user_id = ? ORDER BY created_at DESC LIMIT 20'
  ).all(userId);
}

function getWeeklyDigest(userId, id) {
  const row = db.prepare('SELECT * FROM weekly_digests WHERE id = ? AND user_id = ?').get(id, userId);
  if (!row) return null;
  return { ...row, content: JSON.parse(row.content) };
}

// ─── Message tracking ─────────────────────────────────────────

function isMessageFetched(userId, messageId) {
  return !!db.prepare('SELECT 1 FROM fetched_message_ids WHERE user_id = ? AND message_id = ?').get(userId, messageId);
}

function markMessageFetched(userId, messageId) {
  db.prepare('INSERT OR IGNORE INTO fetched_message_ids (user_id, message_id) VALUES (?, ?)').run(userId, messageId);
}

// ─── Story Ratings ────────────────────────────────────────────

/**
 * Upsert a story rating. Re-rating the same story overwrites the previous rating.
 * Passing rating=null removes the rating (toggle off).
 */
function saveRating({ storyId, userId, digestId, rating, source, storyTopic, storySource, storyHeadline }) {
  if (rating === null) {
    db.prepare('DELETE FROM story_ratings WHERE story_id = ? AND user_id = ?').run(storyId, userId);
    return null;
  }
  db.prepare(`
    INSERT INTO story_ratings (story_id, user_id, digest_id, rating, source, story_topic, story_source, story_headline)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(story_id, user_id) DO UPDATE SET
      rating         = excluded.rating,
      digest_id      = excluded.digest_id,
      source         = excluded.source,
      story_topic    = excluded.story_topic,
      story_source   = excluded.story_source,
      story_headline = excluded.story_headline,
      rated_at       = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  `).run(storyId, userId, digestId ?? null, rating, source || 'web', storyTopic ?? null, storySource ?? null, storyHeadline ?? null);
  return { storyId, userId, rating };
}

function getRatingsByDigest(userId, digestId) {
  return db.prepare(
    'SELECT story_id, rating FROM story_ratings WHERE user_id = ? AND digest_id = ?'
  ).all(userId, digestId);
}

function getRatings(userId, { limit = 50, offset = 0 } = {}) {
  return db.prepare(`
    SELECT story_id, digest_id, rating, source, story_topic, story_source, story_headline, rated_at
    FROM story_ratings
    WHERE user_id = ?
    ORDER BY rated_at DESC
    LIMIT ? OFFSET ?
  `).all(userId, limit, offset);
}

function getRatingByStory(userId, storyId) {
  return db.prepare(
    'SELECT * FROM story_ratings WHERE user_id = ? AND story_id = ?'
  ).get(userId, storyId);
}

module.exports = {
  // Users
  findUserByGoogleId, findUserByEmail, findUserById,
  createUser, updateUser, getAllUsers, getUsersByDailyCronHour,
  // Invite codes
  generateInviteCode, validateInviteCode, redeemInviteCode, getInviteCodes,
  // Sources
  getSources, addSource, removeSource, updateSource,
  // Tokens
  saveTokens, getTokens,
  // Digests
  saveDigest, getLatestDigest, getDigests, getDigest,
  // Weekly
  getRecentDailyDigests, saveWeeklyDigest, getLatestWeeklyDigest, getWeeklyDigests, getWeeklyDigest,
  // Message tracking
  isMessageFetched, markMessageFetched,
  // Story ratings
  saveRating, getRatingsByDigest, getRatings, getRatingByStory,
};
