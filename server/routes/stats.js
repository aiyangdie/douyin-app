/** Dashboard aggregates: counters, 14-day trend, storage usage. */
import { all, get } from '../db.js';
import { sendJson } from '../http.js';

const one = (sql, params = []) => get(sql, params)?.n ?? 0;

/** YYYY-MM-DD for `offset` days ago, in local time. */
function dateKey(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function overview(req, res) {
  const days = Math.min(60, Math.max(7, Number(new URL(req.url, 'http://x').searchParams.get('days')) || 14));
  const since = dateKey(days - 1);

  const trend = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    trend.push({ date: dateKey(i), videos: 0, users: 0 });
  }
  const index = new Map(trend.map((point) => [point.date, point]));

  for (const row of all(
    `SELECT substr(created_at, 1, 10) AS d, COUNT(*) AS n
       FROM videos WHERE substr(created_at, 1, 10) >= ? GROUP BY d`,
    [since],
  )) {
    const point = index.get(row.d);
    if (point) point.videos = row.n;
  }
  for (const row of all(
    `SELECT substr(created_at, 1, 10) AS d, COUNT(*) AS n
       FROM users WHERE substr(created_at, 1, 10) >= ? GROUP BY d`,
    [since],
  )) {
    const point = index.get(row.d);
    if (point) point.users = row.n;
  }

  const today = dateKey(0);

  sendJson(res, 200, {
    users: {
      total: one('SELECT COUNT(*) AS n FROM users'),
      active: one("SELECT COUNT(*) AS n FROM users WHERE status = 'active'"),
      banned: one("SELECT COUNT(*) AS n FROM users WHERE status = 'banned'"),
      verified: one('SELECT COUNT(*) AS n FROM users WHERE verified = 1'),
      newToday: one('SELECT COUNT(*) AS n FROM users WHERE substr(created_at, 1, 10) = ?', [today]),
      new7d: one('SELECT COUNT(*) AS n FROM users WHERE substr(created_at, 1, 10) >= ?', [dateKey(6)]),
    },
    videos: {
      total: one('SELECT COUNT(*) AS n FROM videos'),
      pending: one("SELECT COUNT(*) AS n FROM videos WHERE status = 'pending'"),
      approved: one("SELECT COUNT(*) AS n FROM videos WHERE status = 'approved'"),
      rejected: one("SELECT COUNT(*) AS n FROM videos WHERE status = 'rejected'"),
      featured: one('SELECT COUNT(*) AS n FROM videos WHERE featured = 1'),
      uploaded: one("SELECT COUNT(*) AS n FROM videos WHERE source = 'upload'"),
      newToday: one('SELECT COUNT(*) AS n FROM videos WHERE substr(created_at, 1, 10) = ?', [today]),
      storageBytes: one('SELECT COALESCE(SUM(size_bytes), 0) AS n FROM videos'),
    },
    engagement: {
      views: one('SELECT COALESCE(SUM(views), 0) AS n FROM videos'),
      likes: one('SELECT COALESCE(SUM(likes), 0) AS n FROM videos'),
      favorites: one('SELECT COALESCE(SUM(favorites), 0) AS n FROM videos'),
      shares: one('SELECT COALESCE(SUM(shares), 0) AS n FROM videos'),
    },
    comments: {
      total: one('SELECT COUNT(*) AS n FROM comments'),
      hidden: one("SELECT COUNT(*) AS n FROM comments WHERE status = 'hidden'"),
    },
    trend,
  });
}

/** The review queue preview shown on the dashboard. */
export function pending(req, res) {
  const rows = all(
    `SELECT v.id, v.caption, v.cover_path, v.duration_seconds, v.size_bytes, v.created_at,
            u.id AS user_id, u.name AS user_name, u.handle AS user_handle,
            u.avatar_url AS user_avatar, u.verified AS user_verified
       FROM videos v JOIN users u ON u.id = v.user_id
      WHERE v.status = 'pending'
      ORDER BY v.created_at DESC
      LIMIT 6`,
  );

  // Same field names as the video list so the UI has one shape to render.
  sendJson(res, 200, {
    items: rows.map((row) => ({
      id: row.id,
      caption: row.caption,
      coverUrl: row.cover_path,
      durationSeconds: row.duration_seconds,
      sizeBytes: row.size_bytes,
      createdAt: row.created_at,
      user: {
        id: row.user_id,
        name: row.user_name,
        handle: row.user_handle,
        avatarUrl: row.user_avatar,
        verified: Boolean(row.user_verified),
      },
    })),
  });
}
