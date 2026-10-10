/**
 * Public, unauthenticated endpoints consumed by the mobile app.
 *
 * Only `approved` videos are exposed here — that is the whole point of the
 * review queue. The app degrades to its bundled fixtures when this is
 * unreachable, so it still works with the server switched off.
 */
import { all, get, parsePaging } from '../db.js';
import { sendJson } from '../http.js';

/** Turns a stored row into the shape the app's `Video` type expects. */
function toFeedItem(row, baseUrl) {
  return {
    id: row.id,
    creatorId: row.user_id,
    creator: {
      id: row.user_id,
      name: row.user_name,
      handle: row.user_handle,
      avatarUrl: row.user_avatar ? absolute(row.user_avatar, baseUrl) : null,
      verified: Boolean(row.user_verified),
      bio: row.user_bio ?? '',
    },
    caption: row.caption,
    tags: JSON.parse(row.tags || '[]'),
    music: row.music,
    location: row.location,
    videoUrl: row.file_path ? absolute(row.file_path, baseUrl) : null,
    coverUrl: row.cover_path ? absolute(row.cover_path, baseUrl) : null,
    durationSeconds: row.duration_seconds,
    metrics: {
      likes: row.likes,
      comments: row.comments_count,
      favorites: row.favorites,
      shares: row.shares,
    },
    createdAt: row.created_at,
  };
}

const absolute = (path, base) => (path.startsWith('http') ? path : `${base}${path}`);

export function health(req, res) {
  sendJson(res, 200, {
    ok: true,
    service: 'douyin-app-server',
    time: new Date().toISOString(),
    videos: get('SELECT COUNT(*) AS n FROM videos').n,
    approved: get("SELECT COUNT(*) AS n FROM videos WHERE status = 'approved'").n,
  });
}

export function feed(req, res) {
  const params = Object.fromEntries(new URL(req.url, 'http://x').searchParams);
  const { limit, page, offset } = parsePaging(params, { defaultLimit: 10, maxLimit: 50 });

  // Behind a proxy the Host header is what the client actually reached us on.
  const host = req.headers.host ?? 'localhost:4000';
  const baseUrl = `http://${host}`;

  const total = get("SELECT COUNT(*) AS n FROM videos WHERE status = 'approved'").n;
  const rows = all(
    `SELECT v.*, u.name AS user_name, u.handle AS user_handle, u.avatar_url AS user_avatar,
            u.verified AS user_verified, u.bio AS user_bio
       FROM videos v JOIN users u ON u.id = v.user_id
      WHERE v.status = 'approved'
      ORDER BY v.featured DESC, v.created_at DESC
      LIMIT ? OFFSET ?`,
    [limit, offset],
  );

  sendJson(res, 200, {
    items: rows.map((row) => toFeedItem(row, baseUrl)),
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
}

/** Comments for one video, used by the app's comment sheet when online. */
export function videoComments(req, res, { params: pathParams }) {
  const rows = all(
    `SELECT c.id, c.text, c.likes, c.created_at, u.id AS user_id, u.name, u.handle, u.avatar_url, u.verified
       FROM comments c LEFT JOIN users u ON u.id = c.user_id
      WHERE c.video_id = ? AND c.status = 'visible'
      ORDER BY c.likes DESC LIMIT 50`,
    [pathParams.id],
  );

  sendJson(res, 200, {
    items: rows.map((row) => ({
      id: row.id,
      text: row.text,
      likes: row.likes,
      timeLabel: '刚刚',
      author: {
        id: row.user_id,
        name: row.name ?? '匿名用户',
        handle: row.handle ?? '',
        avatarUrl: row.avatar_url,
        verified: Boolean(row.verified),
      },
    })),
  });
}
