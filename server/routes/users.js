/** User management: list, detail, and moderation actions. */
import { all, audit, get, nowIso, parsePaging, run } from '../db.js';
import { readJson, sendError, sendJson } from '../http.js';

const SORTS = {
  newest: 'u.created_at DESC',
  oldest: 'u.created_at ASC',
  followers: 'u.followers DESC',
  likes: 'u.likes DESC',
  videos: 'video_count DESC',
  active: 'u.last_active_at DESC',
};

function listFilters(params) {
  const clauses = [];
  const values = [];

  if (params.q) {
    clauses.push('(u.name LIKE ? OR u.handle LIKE ? OR u.id LIKE ?)');
    const like = `%${params.q}%`;
    values.push(like, like, like);
  }
  if (params.status && params.status !== 'all') {
    clauses.push('u.status = ?');
    values.push(params.status);
  }
  if (params.verified === '1') clauses.push('u.verified = 1');
  if (params.verified === '0') clauses.push('u.verified = 0');

  return { where: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '', values };
}

export function list(req, res) {
  const params = Object.fromEntries(new URL(req.url, 'http://x').searchParams);
  const { limit, page, offset } = parsePaging(params);
  const { where, values } = listFilters(params);
  const orderBy = SORTS[params.sort] ?? SORTS.newest;

  const total = get(`SELECT COUNT(*) AS n FROM users u${where}`, values).n;

  const items = all(
    `SELECT u.id, u.name, u.handle, u.avatar_url, u.bio, u.verified, u.status, u.ban_reason,
            u.followers, u.following, u.likes, u.created_at, u.last_active_at,
            (SELECT COUNT(*) FROM videos v WHERE v.user_id = u.id) AS video_count
       FROM users u${where}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?`,
    [...values, limit, offset],
  );

  sendJson(res, 200, { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) });
}

export function detail(req, res, { params: pathParams }) {
  const user = get('SELECT * FROM users WHERE id = ?', [pathParams.id]);
  if (!user) return sendError(res, 404, '用户不存在');

  const videos = all(
    `SELECT id, caption, cover_path, status, views, likes, comments_count, duration_seconds, created_at
       FROM videos WHERE user_id = ? ORDER BY created_at DESC LIMIT 24`,
    [user.id],
  );

  const comments = all(
    `SELECT c.id, c.text, c.likes, c.status, c.created_at, c.video_id, v.caption AS video_caption
       FROM comments c LEFT JOIN videos v ON v.id = c.video_id
      WHERE c.user_id = ? ORDER BY c.created_at DESC LIMIT 12`,
    [user.id],
  );

  const totals = get(
    `SELECT COALESCE(SUM(views), 0) AS views, COALESCE(SUM(likes), 0) AS likes,
            COALESCE(SUM(size_bytes), 0) AS bytes
       FROM videos WHERE user_id = ?`,
    [user.id],
  );

  sendJson(res, 200, { user, videos, comments, totals });
}

export async function update(req, res, { admin, params: pathParams }) {
  const body = await readJson(req);
  const user = get('SELECT * FROM users WHERE id = ?', [pathParams.id]);
  if (!user) return sendError(res, 404, '用户不存在');

  const fields = [];
  const values = [];
  const changes = {};

  if (body.status !== undefined) {
    if (!['active', 'banned'].includes(body.status)) return sendError(res, 400, '状态只能是 active 或 banned');
    fields.push('status = ?');
    values.push(body.status);
    changes.status = body.status;
    if (body.status === 'active') {
      fields.push('ban_reason = NULL');
    }
  }
  if (body.banReason !== undefined) {
    fields.push('ban_reason = ?');
    values.push(body.banReason || null);
    changes.banReason = body.banReason || null;
  }
  if (body.verified !== undefined) {
    fields.push('verified = ?');
    values.push(body.verified ? 1 : 0);
    changes.verified = Boolean(body.verified);
  }
  if (body.name !== undefined && String(body.name).trim()) {
    fields.push('name = ?');
    values.push(String(body.name).trim());
    changes.name = String(body.name).trim();
  }
  if (body.bio !== undefined) {
    fields.push('bio = ?');
    values.push(String(body.bio));
    changes.bio = String(body.bio);
  }

  if (fields.length === 0) return sendError(res, 400, '没有可更新的字段');

  run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, [...values, user.id]);
  audit(admin, 'user.update', 'user', user.id, changes);

  sendJson(res, 200, { user: get('SELECT * FROM users WHERE id = ?', [user.id]) });
}

/** Hard delete: cascades to the user's videos and comments via foreign keys. */
export function remove(req, res, { admin, params: pathParams }) {
  const user = get('SELECT id, name FROM users WHERE id = ?', [pathParams.id]);
  if (!user) return sendError(res, 404, '用户不存在');

  const videoCount = get('SELECT COUNT(*) AS n FROM videos WHERE user_id = ?', [user.id]).n;
  run('DELETE FROM users WHERE id = ?', [user.id]);
  audit(admin, 'user.delete', 'user', user.id, { name: user.name, cascadeVideos: videoCount });

  sendJson(res, 200, { ok: true, deletedVideos: videoCount, at: nowIso() });
}
