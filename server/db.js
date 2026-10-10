/**
 * SQLite storage for the backend.
 *
 * Uses Node's built-in `node:sqlite` rather than better-sqlite3 / sqlite3, so
 * the whole server has **zero npm dependencies**. That matters here: this
 * machine has had repeated trouble with npm (allow-scripts policy, a blocked
 * plugin portal, a mirrored registry), and "no install step" removes an entire
 * class of failure.
 *
 * Schema is created on import, so a fresh clone just works.
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

export const SERVER_DIR = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = join(SERVER_DIR, 'data');
export const UPLOAD_DIR = join(SERVER_DIR, 'uploads');
export const VIDEO_DIR = join(UPLOAD_DIR, 'videos');
export const COVER_DIR = join(UPLOAD_DIR, 'covers');
export const AVATAR_DIR = join(UPLOAD_DIR, 'avatars');

for (const dir of [DATA_DIR, UPLOAD_DIR, VIDEO_DIR, COVER_DIR, AVATAR_DIR]) {
  mkdirSync(dir, { recursive: true });
}

export const db = new DatabaseSync(join(DATA_DIR, 'app.db'));

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS admins (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL DEFAULT '管理员',
  role          TEXT NOT NULL DEFAULT 'admin',
  created_at    TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  admin_id   INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  handle         TEXT NOT NULL UNIQUE,
  avatar_url     TEXT,
  bio            TEXT NOT NULL DEFAULT '',
  verified       INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'active',
  ban_reason     TEXT,
  following      INTEGER NOT NULL DEFAULT 0,
  followers      INTEGER NOT NULL DEFAULT 0,
  likes          INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL,
  last_active_at TEXT
);

CREATE TABLE IF NOT EXISTS videos (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL DEFAULT '',
  caption          TEXT NOT NULL DEFAULT '',
  tags             TEXT NOT NULL DEFAULT '[]',
  music            TEXT NOT NULL DEFAULT '',
  location         TEXT,
  file_path        TEXT,
  cover_path       TEXT,
  mime_type        TEXT NOT NULL DEFAULT 'video/mp4',
  duration_seconds REAL NOT NULL DEFAULT 0,
  size_bytes       INTEGER NOT NULL DEFAULT 0,
  width            INTEGER,
  height           INTEGER,
  status           TEXT NOT NULL DEFAULT 'pending',
  reject_reason    TEXT,
  featured         INTEGER NOT NULL DEFAULT 0,
  views            INTEGER NOT NULL DEFAULT 0,
  likes            INTEGER NOT NULL DEFAULT 0,
  comments_count   INTEGER NOT NULL DEFAULT 0,
  favorites        INTEGER NOT NULL DEFAULT 0,
  shares           INTEGER NOT NULL DEFAULT 0,
  source           TEXT NOT NULL DEFAULT 'seed',
  created_at       TEXT NOT NULL,
  reviewed_at      TEXT,
  reviewed_by      TEXT
);

CREATE TABLE IF NOT EXISTS comments (
  id         TEXT PRIMARY KEY,
  video_id   TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL,
  text       TEXT NOT NULL,
  likes      INTEGER NOT NULL DEFAULT 0,
  status     TEXT NOT NULL DEFAULT 'visible',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id    INTEGER,
  admin_name  TEXT,
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  detail      TEXT,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_videos_status     ON videos(status);
CREATE INDEX IF NOT EXISTS idx_videos_user       ON videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_created    ON videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_video    ON comments(video_id);
CREATE INDEX IF NOT EXISTS idx_comments_status   ON comments(status);
CREATE INDEX IF NOT EXISTS idx_users_status      ON users(status);
CREATE INDEX IF NOT EXISTS idx_audit_created     ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_admin    ON sessions(admin_id);
`);

/** Thin wrappers so callers never touch prepare() directly. */
export const all = (sql, params = []) => db.prepare(sql).all(...params);
export const get = (sql, params = []) => db.prepare(sql).get(...params);
export const run = (sql, params = []) => db.prepare(sql).run(...params);

export const nowIso = () => new Date().toISOString();

/** ISO timestamp `days` in the past — used by the seed to spread history out. */
export function daysAgo(days, hourOffset = 0) {
  // A NaN here silently produced an Invalid Date and a cryptic RangeError from
  // toISOString(), so fail loudly with the offending value instead.
  if (!Number.isFinite(days)) {
    throw new TypeError(`daysAgo() 需要有限数值，收到 ${days}`);
  }
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(9 + hourOffset, Math.abs(days * 17) % 60, 0, 0);
  return d.toISOString();
}

/** Offset pagination with a hard cap, shared by every list endpoint. */
export function parsePaging(query, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const limit = Math.min(maxLimit, Math.max(1, Number(query.limit) || defaultLimit));
  const page = Math.max(1, Number(query.page) || 1);
  return { limit, page, offset: (page - 1) * limit };
}

/** Builds `WHERE` fragments from optional filters, skipping empty values. */
export function whereFrom(clauses) {
  const active = clauses.filter(Boolean);
  return {
    sql: active.length ? ` WHERE ${active.map((c) => c.sql).join(' AND ')}` : '',
    params: active.flatMap((c) => c.params),
  };
}

/** Records an admin action. Every mutation goes through here. */
export function audit(admin, action, targetType, targetId, detail) {
  run(
    `INSERT INTO audit_logs (admin_id, admin_name, action, target_type, target_id, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      admin?.id ?? null,
      admin?.username ?? 'system',
      action,
      targetType ?? null,
      targetId == null ? null : String(targetId),
      detail == null ? null : typeof detail === 'string' ? detail : JSON.stringify(detail),
      nowIso(),
    ],
  );
}
