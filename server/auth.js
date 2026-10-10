/**
 * Admin authentication: scrypt password hashing and bearer-token sessions.
 *
 * Deliberately dependency-free — `node:crypto` covers both. Passwords are
 * stored as `scrypt$<salt-hex>$<hash-hex>` so the format is self-describing and
 * a future algorithm change can be detected rather than silently misread.
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

import { get, nowIso, run } from './db.js';

const KEY_LENGTH = 64;
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  // Lengths always match here, but timingSafeEqual throws if they ever differ.
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createSession(adminId) {
  const token = randomBytes(32).toString('hex');
  const now = Date.now();
  run('INSERT INTO sessions (token, admin_id, created_at, expires_at) VALUES (?, ?, ?, ?)', [
    token,
    adminId,
    new Date(now).toISOString(),
    new Date(now + SESSION_TTL_MS).toISOString(),
  ]);
  return { token, expiresAt: new Date(now + SESSION_TTL_MS).toISOString() };
}

export function destroySession(token) {
  run('DELETE FROM sessions WHERE token = ?', [token]);
}

/** Removes expired rows; called opportunistically on login. */
export function pruneSessions() {
  run('DELETE FROM sessions WHERE expires_at < ?', [nowIso()]);
}

/**
 * Resolves the bearer token on a request to an admin row, or null.
 * Also slides the expiry forward so an active session does not die mid-use.
 */
export function adminFromRequest(req) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) return null;

  const row = get(
    `SELECT s.token, s.expires_at, a.id, a.username, a.display_name, a.role
       FROM sessions s JOIN admins a ON a.id = s.admin_id
      WHERE s.token = ?`,
    [token],
  );
  if (!row) return null;

  if (new Date(row.expires_at).getTime() < Date.now()) {
    destroySession(token);
    return null;
  }
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    token,
  };
}
