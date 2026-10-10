/**
 * Small HTTP helpers: JSON bodies, standard error shapes, static files.
 *
 * Static serving implements HTTP Range, which matters because the admin's
 * video preview seeks and the app streams — without 206 responses the player
 * has to download the whole file before scrubbing.
 */
import { createReadStream, statSync } from 'node:fs';
import { extname } from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

export const mimeFor = (path) => MIME[extname(path).toLowerCase()] ?? 'application/octet-stream';

export function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Max-Age', '600');
}

export function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

export function sendError(res, status, message, extra = {}) {
  sendJson(res, status, { error: { message, status, ...extra } });
}

/** Reads a JSON request body, refusing anything over `maxBytes`. */
export function readJson(req, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(Object.assign(new Error('请求体过大'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('JSON 格式错误'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

/** Reads a raw binary body (used by the upload endpoint). */
export function readBuffer(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(Object.assign(new Error(`文件超过上限 ${Math.round(maxBytes / 1048576)} MB`), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * Streams a file from disk, honouring a single-range `Range` header.
 * Returns false when the path does not exist so callers can fall through.
 */
export function serveFile(req, res, absolutePath, { contentType, downloadName } = {}) {
  let stat;
  try {
    stat = statSync(absolutePath);
  } catch {
    return false;
  }
  if (!stat.isFile()) return false;

  const type = contentType ?? mimeFor(absolutePath);
  const headers = {
    'Content-Type': type,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=60',
  };
  if (downloadName) {
    headers['Content-Disposition'] = `attachment; filename="${encodeURIComponent(downloadName)}"`;
  }

  const range = req.headers.range;
  const match = range && /^bytes=(\d*)-(\d*)$/.exec(range);

  if (match) {
    let start = match[1] === '' ? null : Number(match[1]);
    let end = match[2] === '' ? null : Number(match[2]);

    if (start === null && end !== null) {
      // Suffix range: last N bytes.
      start = Math.max(0, stat.size - end);
      end = stat.size - 1;
    } else if (start !== null && end === null) {
      end = stat.size - 1;
    } else if (start === null) {
      start = 0;
      end = stat.size - 1;
    }

    if (start > end || start >= stat.size) {
      res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
      res.end();
      return true;
    }
    end = Math.min(end, stat.size - 1);

    res.writeHead(206, {
      ...headers,
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Content-Length': end - start + 1,
    });
    createReadStream(absolutePath, { start, end }).pipe(res);
    return true;
  }

  res.writeHead(200, { ...headers, 'Content-Length': stat.size });
  createReadStream(absolutePath).pipe(res);
  return true;
}
