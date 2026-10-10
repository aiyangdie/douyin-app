/** Comment moderation: list with filters, hide/restore, delete. */
import { all, audit, get, parsePaging, run } from '../db.js';
import { readJson, sendError, sendJson } from '../http.js';

/** Words that get highlighted in the admin UI when present. */
const SENSITIVE = ['广告', '微信', '加我', '私聊', '代购', '刷单', '博彩', '返利'];

function decorate(row) {
  const hits = SENSITIVE.filter((word) => row.text.includes(word));
  return { ...row, sensitive: hits };
}

export function list(req, res) {
  const params = Object.fromEntries(new URL(req.url, 'http://x').searchParams);
  const { limit, page, offset } = parsePaging(params);

  const clauses = [];
  const values = [];
  if (params.q) {
    clauses.push('c.text LIKE ?');
    values.push(`%${params.q}%`);
  }
  if (params.status && params.status !== 'all') {
    clauses.push('c.status = ?');
    values.push(params.status);
  }
  if (params.videoId) {
    clauses.push('c.video_id = ?');
    values.push(params.videoId);
  }
  if (params.sensitive === '1') {
    clauses.push(`(${SENSITIVE.map(() => 'c.text LIKE ?').join(' OR ')})`);
    SENSITIVE.forEach((word) => values.push(`%${word}%`));
  }
  const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';

  const total = get(`SELECT COUNT(*) AS n FROM comments c${where}`, values).n;
  const items = all(
    `SELECT c.id, c.text, c.likes, c.status, c.created_at, c.video_id,
            u.name AS user_name, u.handle AS user_handle, u.avatar_url AS user_avatar,
            v.caption AS video_caption, v.cover_path AS video_cover
       FROM comments c
       LEFT JOIN users u ON u.id = c.user_id
       LEFT JOIN videos v ON v.id = c.video_id
       ${where}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?`,
    [...values, limit, offset],
  ).map(decorate);

  sendJson(res, 200, { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) });
}

export async function update(req, res, { admin, params: pathParams }) {
  const body = await readJson(req);
  const comment = get('SELECT * FROM comments WHERE id = ?', [pathParams.id]);
  if (!comment) return sendError(res, 404, '评论不存在');

  if (!['visible', 'hidden'].includes(body.status)) {
    return sendError(res, 400, '状态只能是 visible 或 hidden');
  }

  run('UPDATE comments SET status = ? WHERE id = ?', [body.status, comment.id]);
  audit(admin, body.status === 'hidden' ? 'comment.hide' : 'comment.restore', 'comment', comment.id, {
    text: comment.text.slice(0, 60),
  });

  sendJson(res, 200, { comment: get('SELECT * FROM comments WHERE id = ?', [comment.id]) });
}

export function remove(req, res, { admin, params: pathParams }) {
  const comment = get('SELECT * FROM comments WHERE id = ?', [pathParams.id]);
  if (!comment) return sendError(res, 404, '评论不存在');

  run('DELETE FROM comments WHERE id = ?', [comment.id]);
  if (comment.video_id) {
    run(
      'UPDATE videos SET comments_count = MAX(0, comments_count - 1) WHERE id = ?',
      [comment.video_id],
    );
  }
  audit(admin, 'comment.delete', 'comment', comment.id, { text: comment.text.slice(0, 60) });

  sendJson(res, 200, { ok: true });
}
