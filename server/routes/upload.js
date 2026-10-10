/**
 * Video upload.
 *
 * Accepts `multipart/form-data` with one video part plus optional text fields.
 * Uploads land as `pending` so they flow through the review queue rather than
 * appearing in the feed immediately.
 *
 * Cover generation is opportunistic: if `ffmpeg` happens to be on PATH we pull
 * a real frame, otherwise the admin falls back to a placeholder. Requiring
 * ffmpeg would make the server fail to start on machines without it.
 */
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { COVER_DIR, SERVER_DIR, VIDEO_DIR, audit, get, nowIso, run } from '../db.js';
import { readBuffer, sendError, sendJson } from '../http.js';
import { boundaryFrom, parseMultipart } from '../multipart.js';

const execFileAsync = promisify(execFile);

const MAX_BYTES = 200 * 1024 * 1024; // 200 MB
const ALLOWED = /^video\/(mp4|quicktime|webm|x-matroska|3gpp)$/i;

const newId = () => `up_${Date.now().toString(36)}_${randomBytes(3).toString('hex')}`;

/** Best-effort frame grab. Resolves to the cover path, or null. */
async function extractCover(videoPath, coverPath) {
  try {
    await execFileAsync(
      'ffmpeg',
      ['-y', '-hide_banner', '-loglevel', 'error', '-ss', '1', '-i', videoPath,
       '-frames:v', '1', '-vf', 'scale=360:-2', '-q:v', '4', coverPath],
      { timeout: 20_000, windowsHide: true },
    );
    return coverPath;
  } catch {
    return null;
  }
}

export async function upload(req, res, { admin }) {
  const boundary = boundaryFrom(req.headers['content-type']);
  if (!boundary) {
    return sendError(res, 400, '需要 multipart/form-data 请求');
  }

  const body = await readBuffer(req, MAX_BYTES);
  const { fields, files } = parseMultipart(body, boundary);

  const videoPart = files.find((f) => f.field === 'file') ?? files[0];
  if (!videoPart || videoPart.data.length === 0) {
    return sendError(res, 400, '没有收到视频文件');
  }
  if (!ALLOWED.test(videoPart.contentType)) {
    return sendError(res, 415, `不支持的视频格式：${videoPart.contentType}`);
  }

  const id = newId();
  const videoPath = join(VIDEO_DIR, `${id}.mp4`);
  writeFileSync(videoPath, videoPart.data);

  const coverPath = await extractCover(videoPath, join(COVER_DIR, `${id}.jpg`));

  // Uploads are attributed to `me` unless the caller names another account.
  const userId = fields.userId && get('SELECT id FROM users WHERE id = ?', [fields.userId])
    ? fields.userId
    : 'me';

  const tags = (() => {
    if (!fields.tags) return [];
    try {
      const parsed = JSON.parse(fields.tags);
      return Array.isArray(parsed) ? parsed.map(String).slice(0, 8) : [];
    } catch {
      return String(fields.tags).split(/[\s,]+/).filter(Boolean).slice(0, 8);
    }
  })();

  const caption = String(fields.caption ?? '').slice(0, 300) || '未命名作品';

  run(
    `INSERT INTO videos (id, user_id, title, caption, tags, music, location, file_path, cover_path,
                         mime_type, duration_seconds, size_bytes, width, height, status, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'upload', ?)`,
    [
      id,
      userId,
      caption.slice(0, 18),
      caption,
      JSON.stringify(tags),
      String(fields.music ?? '原声').slice(0, 120),
      fields.location ? String(fields.location).slice(0, 60) : null,
      `/uploads/videos/${id}.mp4`,
      coverPath ? `/uploads/covers/${id}.jpg` : null,
      videoPart.contentType,
      Number(fields.durationSeconds) || 0,
      videoPart.data.length,
      Number(fields.width) || null,
      Number(fields.height) || null,
      nowIso(),
    ],
  );

  audit(admin ?? { username: 'app' }, 'video.upload', 'video', id, {
    filename: videoPart.filename,
    bytes: videoPart.data.length,
    cover: Boolean(coverPath),
  });

  sendJson(res, 201, {
    ok: true,
    video: {
      id,
      status: 'pending',
      caption,
      filePath: `/uploads/videos/${id}.mp4`,
      coverPath: coverPath ? `/uploads/covers/${id}.jpg` : null,
      sizeBytes: videoPart.data.length,
      // Surfaced so the client can explain the placeholder it will see.
      coverGenerated: Boolean(coverPath),
    },
    hint: '视频已进入待审核队列，审核通过后才会出现在推荐流中',
  });
}

export { SERVER_DIR };
