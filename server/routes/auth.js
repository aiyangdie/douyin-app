/** Login / logout / current-admin endpoints. */
import {
  adminFromRequest,
  createSession,
  destroySession,
  pruneSessions,
  verifyPassword,
} from '../auth.js';
import { get, nowIso, run } from '../db.js';
import { readJson, sendError, sendJson } from '../http.js';

export async function login(req, res) {
  const { username, password } = await readJson(req);
  if (!username || !password) {
    return sendError(res, 400, '请输入账号和密码');
  }

  const admin = get('SELECT * FROM admins WHERE username = ?', [String(username).trim()]);
  // Same message either way so the endpoint cannot be used to enumerate accounts.
  if (!admin || !verifyPassword(String(password), admin.password_hash)) {
    return sendError(res, 401, '账号或密码错误');
  }

  pruneSessions();
  const { token, expiresAt } = createSession(admin.id);
  run('UPDATE admins SET last_login_at = ? WHERE id = ?', [nowIso(), admin.id]);

  sendJson(res, 200, {
    token,
    expiresAt,
    admin: {
      id: admin.id,
      username: admin.username,
      displayName: admin.display_name,
      role: admin.role,
    },
  });
}

export function logout(req, res, { admin }) {
  destroySession(admin.token);
  sendJson(res, 200, { ok: true });
}

export function me(req, res, { admin }) {
  sendJson(res, 200, {
    admin: {
      id: admin.id,
      username: admin.username,
      displayName: admin.displayName,
      role: admin.role,
    },
  });
}

export function requireAdmin(req) {
  const admin = adminFromRequest(req);
  if (!admin) throw Object.assign(new Error('未登录或会话已过期'), { status: 401 });
  return admin;
}
