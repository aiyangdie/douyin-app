/** Audit trail: every admin mutation is recorded in db.audit(). */
import { all, get, parsePaging } from '../db.js';
import { sendJson } from '../http.js';

export function list(req, res) {
  const url = new URL(req.url, 'http://x');
  const { limit, page, offset } = parsePaging(Object.fromEntries(url.searchParams), {
    defaultLimit: 30,
    maxLimit: 200,
  });

  const total = get('SELECT COUNT(*) AS n FROM audit_logs').n;
  const items = all(
    `SELECT id, admin_name, action, target_type, target_id, detail, created_at
       FROM audit_logs ORDER BY id DESC LIMIT ? OFFSET ?`,
    [limit, offset],
  );

  sendJson(res, 200, { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) });
}
