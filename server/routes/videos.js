/** Video management: list, detail, review actions, bulk operations, delete. */
import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

import { SERVER_DIR, all, audit, get, nowIso, parsePaging, run } from '../db.js';
import { readJson, sendError, sendJson } from '../http.js';

const SORTS = {
  newest: 'v.created_at DESC',
  oldest: 'v.created_at ASC',
  views: 'v.views DESC',
  likes: 'v.likes DESC',
  size: 'v.size_bytes DESC',
  duration: 'v.duration_seconds DESC',
};

const VALID_STATUS = ['pending', 'approved', 'rejected'];

/** Maps a stored row to the shape the admin UI consumes. */
export function toApi(row) {
  return {
    id: row.id,
    userId: row.user_id,
    user: {
      id: row.user_id,
      name: row.user_name,
      handle: row.user_handle,
      avatarUrl: row.user_avatar,
      verified: Boolean(row.user_verified),
    },
    title: row.title,
    caption: row.caption,
    tags: JSON.parse(row.tags || '[]'),
    music: row.music,
    location: row.location,
    filePath: row.file_path,
    coverPath: row.cover_path,
    mimeType: row.mime_type,
    durationSeconds: row.duration_seconds,
    sizeBytes: row.size_bytes,
    width: row.width,
    height: row.height,
    status: row.status,
    rejectReason: row.reject_reason,
    featured: Boolean(row.featured),
    source: row.source,
    metrics: {
      views: row.views,
      likes: row.likes,
      comments: row.comments_count,
      favorites: row.favorites,
      shares: row.shares,
    },
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
  };
}

const SELECT_WITH_USER = `
  SELECT v.*, u.name AS user_name, u.handle AS user_handle,
         u.avatar_url AS user_avatar, u.verified AS user_verified
    FROM videos v JOIN users u ON u.id = v.user_id`;

function filters(params) {
  const clauses = [];
  const values = [];

  if (params.q) {
    clauses.push('(v.caption LIKE ? OR v.title LIKE ? OR v.music LIKE ? OR u.name LIKE ?)');
    const like = `%${params.q}%`;
    values.push(like, like, like, like);
  }
  if (params.status && params.status !== 'all') {
    clauses.push('v.status = ?');
    values.push(params.status);
  }
  if (params.userId) {
    clauses.push('v.user_id = ?');
    values.push(params.userId);
  }
  if (params.source && params.source !== 'all') {
    clauses.push('v.source = ?');
    values.push(params.source);
  }
  if (params.featured === '1') clauses.push('v.featured = 1');

  return { where: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '', values };
}

export function list(req, res) {
  const params = Object.fromEntries(new URL(req.url, 'http://x').searchParams);
  const { limit, page, offset } = parsePaging(params);
  const { where, values } = filters(params);
  const orderBy = SORTS[params.sort] ?? SORTS.newest;

  const total = get(
    `SELECT COUNT(*) AS n FROM videos v JOIN users u ON u.id = v.user_id${where}`,
    values,
  ).n;

  const rows = all(`${SELECT_WITH_USER}${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`, [
    ...values,
    limit,
    offset,
  ]);

  sendJson(res, 200, {
    items: rows.map(toApi),
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
}

export function detail(req, res, { params: pathParams }) {
  const row = get(`${SELECT_WITH_USER} WHERE v.id = ?`, [pathParams.id]);
  if (!row) return sendError(res, 404, '视频不存在');

  const comments = all(
    `SELECT c.id, c.text, c.likes, c.status, c.created_at,
            u.name AS user_name, u.avatar_url AS user_avatar
       FROM comments c LEFT JOIN users u ON u.id = c.user_id
      WHERE c.video_id = ? ORDER BY c.created_at DESC LIMIT 50`,
    [row.id],
  );

  sendJson(res, 200, { video: toApi(row), comments });
}

export async function update(req, res, { admin, params: pathParams }) {
  const body = await readJson(req);
  const row = get('SELECT * FROM videos WHERE id = ?', [pathParams.id]);
  if (!row) return sendError(res, 404, '视频不存在');

  const fields = [];
  const values = [];
  const changes = {};

  if (body.status !== undefined) {
    if (!VALID_STATUS.includes(body.status)) {
      return sendError(res, 400, `状态只能是 ${VALID_STATUS.join(' / ')}`);
    }
    fields.push('status = ?', 'reviewed_at = ?', 'reviewed_by = ?');
    values.push(body.status, nowIso(), admin.username);
    changes.status = body.status;

    // Rejection carries a reason; approving clears any previous one.
    fields.push('reject_reason = ?');
    values.push(body.status === 'rejected' ? (body.rejectReason || '未填写原因') : null);
    if (body.status === 'rejected') changes.rejectReason = body.rejectReason || '未填写原因';
  }

  if (body.featured !== undefined) {
    fields.push('featured = ?');
    values.push(body.featured ? 1 : 0);
    changes.featured = Boolean(body.featured);
  }
  if (body.title !== undefined) {
    fields.push('title = ?');
    values.push(String(body.title).slice(0, 80));
    changes.title = String(body.title).slice(0, 80);
  }
  if (body.caption !== undefined) {
    fields.push('caption = ?');
    values.push(String(body.caption));
    changes.caption = 'updated';
  }

  if (fields.length === 0) return sendError(res, 400, '没有可更新的字段');

  run(`UPDATE videos SET ${fields.join(', ')} WHERE id = ?`, [...values, row.id]);

  const action =
    changes.status === 'approved' ? 'video.approve'
      : changes.status === 'rejected' ? 'video.reject'
        : changes.featured !== undefined ? 'video.feature'
          : 'video.update';
  audit(admin, action, 'video', row.id, changes);

  sendJson(res, 200, { video: toApi(get(`${SELECT_WITH_USER} WHERE v.id = ?`, [row.id])) });
}

/** Bulk approve / reject / delete from the review queue. */
export async function bulk(req, res, { admin }) {
  const body = await readJson(req);
  const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];
  const action = body.action;

  if (ids.length === 0) return sendError(res, 400, '未选择视频');
  if (!['approve', 'reject', 'delete'].includes(action)) {
    return sendError(res, 400, 'action 只能是 approve / reject / delete');
  }

  let affected = 0;
  for (const id of ids) {
    const row = get('SELECT id FROM videos WHERE id = ?', [id]);
    if (!row) continue;

    if (action === 'delete') {
      deleteFiles(id);
      run('DELETE FROM videos WHERE id = ?', [id]);
    } else if (action === 'approve') {
      run(
        `UPDATE videos SET status = 'approved', reject_reason = NULL, reviewed_at = ?, reviewed_by = ? WHERE id = ?`,
        [nowIso(), admin.username, id],
      );
    } else {
      run(
        `UPDATE videos SET status = 'rejected', reject_reason = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?`,
        [body.reason || '批量驳回', nowIso(), admin.username, id],
      );
    }
    affected += 1;
  }

  audit(admin, `video.bulk.${action}`, 'video', ids.join(','), { count: affected, reason: body.reason });
  sendJson(res, 200, { ok: true, affected });
}

function deleteFiles(id) {
  for (const candidate of [
    join(SERVER_DIR, 'uploads', 'videos', `${id}.mp4`),
    join(SERVER_DIR, 'uploads', 'covers', `${id}.jpg`),
  ]) {
    if (existsSync(candidate)) {
      try {
        unlinkSync(candidate);
      } catch {
        /* the row is going away regardless; a leftover file is not fatal */
      }
    }
  }
}

export function remove(req, res, { admin, params: pathParams }) {
  const row = get('SELECT id FROM videos WHERE id = ?', [pathParams.id]);
  if (!row) return sendError(res, 404, '视频不存在');

  deleteFiles(row.id);
  run('DELETE FROM videos WHERE id = ?', [row.id]);
  audit(admin, 'video.delete', 'video', row.id, null);

  sendJson(res, 200, { ok: true });
}
