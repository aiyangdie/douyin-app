/**
 * Douyin clone backend — zero npm dependencies.
 *
 *   node server/index.js            # http://localhost:4000
 *   PORT=5000 node server/index.js
 *
 * Serves three things on one port:
 *   /            the admin console (static files from ./admin)
 *   /api/*       JSON API (admin routes require a bearer token)
 *   /uploads/*   uploaded videos, covers and avatars, with HTTP Range support
 *
 * Node's built-in `node:http` and `node:sqlite` cover everything, so there is
 * no install step -- which is deliberate on a machine where npm has been
 * unreliable.
 */
import { createServer } from 'node:http';
import { existsSync, statSync } from 'node:fs';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { adminFromRequest } from './auth.js';
import { UPLOAD_DIR } from './db.js';
import { sendError, serveFile, setCors } from './http.js';
import { DEFAULT_ADMIN, seed } from './seed.js';

import * as authRoutes from './routes/auth.js';
import * as commentRoutes from './routes/comments.js';
import * as feedRoutes from './routes/feed.js';
import * as logRoutes from './routes/logs.js';
import * as statRoutes from './routes/stats.js';
import * as uploadRoutes from './routes/upload.js';
import * as userRoutes from './routes/users.js';
import * as videoRoutes from './routes/videos.js';

const SERVER_DIR = dirname(fileURLToPath(import.meta.url));
const ADMIN_DIR = resolve(SERVER_DIR, '..', 'admin');
const PORT = Number(process.env.PORT) || 4000;

/**
 * `auth: true` marks a route as requiring an admin session.
 * Order matters: `/api/videos/bulk` must precede `/api/videos/:id`.
 */
const ROUTES = [
  ['GET', '/api/health', feedRoutes.health, false],
  ['GET', '/api/feed', feedRoutes.feed, false],
  ['GET', '/api/videos/:id/comments', feedRoutes.videoComments, false],
  ['POST', '/api/upload', uploadRoutes.upload, false],

  ['POST', '/api/auth/login', authRoutes.login, false],
  ['POST', '/api/auth/logout', authRoutes.logout, true],
  ['GET', '/api/auth/me', authRoutes.me, true],

  ['GET', '/api/stats/overview', statRoutes.overview, true],
  ['GET', '/api/stats/pending', statRoutes.pending, true],

  ['GET', '/api/users', userRoutes.list, true],
  ['POST', '/api/videos/bulk', videoRoutes.bulk, true],
  ['GET', '/api/users/:id', userRoutes.detail, true],
  ['PATCH', '/api/users/:id', userRoutes.update, true],
  ['DELETE', '/api/users/:id', userRoutes.remove, true],

  ['GET', '/api/videos', videoRoutes.list, true],
  ['GET', '/api/videos/:id', videoRoutes.detail, true],
  ['PATCH', '/api/videos/:id', videoRoutes.update, true],
  ['DELETE', '/api/videos/:id', videoRoutes.remove, true],

  ['GET', '/api/comments', commentRoutes.list, true],
  ['PATCH', '/api/comments/:id', commentRoutes.update, true],
  ['DELETE', '/api/comments/:id', commentRoutes.remove, true],

  ['GET', '/api/logs', logRoutes.list, true],
];

function matchPath(pattern, pathname) {
  const want = pattern.split('/');
  const got = pathname.split('/');
  if (want.length !== got.length) return null;

  const params = {};
  for (let i = 0; i < want.length; i += 1) {
    if (want[i].startsWith(':')) {
      params[want[i].slice(1)] = decodeURIComponent(got[i]);
    } else if (want[i] !== got[i]) {
      return null;
    }
  }
  return params;
}

function matchRoute(method, pathname) {
  for (const [routeMethod, pattern, handler, needsAuth] of ROUTES) {
    if (routeMethod !== method) continue;
    const params = matchPath(pattern, pathname);
    if (params) return { handler, needsAuth, params };
  }
  return null;
}

/** Blocks `..` escapes before touching the filesystem. */
function safeJoin(baseDir, relative) {
  const target = resolve(baseDir, `.${normalize(relative)}`);
  const base = resolve(baseDir) + sep;
  return target.startsWith(base) || target === resolve(baseDir) ? target : null;
}

function serveAdmin(req, res, pathname) {
  const relative = pathname === '/' || pathname === '/admin' ? '/index.html' : pathname.replace(/^\/admin/, '');
  const file = safeJoin(ADMIN_DIR, relative);
  if (!file || !existsSync(file) || statSync(file).isDirectory()) return false;
  return serveFile(req, res, file);
}

const server = createServer(async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const { pathname } = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);

  try {
    // ---- static --------------------------------------------------------
    if (pathname.startsWith('/uploads/')) {
      const file = safeJoin(UPLOAD_DIR, pathname.replace(/^\/uploads/, ''));
      if (file && serveFile(req, res, file)) return;
      return sendError(res, 404, '文件不存在');
    }

    if (!pathname.startsWith('/api/')) {
      if (serveAdmin(req, res, pathname)) return;
      // Unknown non-API path: hand back the SPA shell so deep links work.
      if (!pathname.includes('.')) {
        const shell = join(ADMIN_DIR, 'index.html');
        if (existsSync(shell) && serveFile(req, res, shell, { contentType: 'text/html; charset=utf-8' })) return;
      }
      return sendError(res, 404, 'Not found');
    }

    // ---- API -----------------------------------------------------------
    const matched = matchRoute(req.method, pathname);
    if (!matched) return sendError(res, 404, `未知接口 ${req.method} ${pathname}`);

    let admin = null;
    if (matched.needsAuth) {
      admin = adminFromRequest(req);
      if (!admin) return sendError(res, 401, '未登录或会话已过期');
    }

    await matched.handler(req, res, { admin, params: matched.params });
  } catch (error) {
    const status = error.status ?? 500;
    if (status >= 500) console.error(`[500] ${req.method} ${pathname}`, error);
    if (!res.headersSent) sendError(res, status, error.message || '服务器内部错误');
  }
});

const result = seed();
if (result.seeded) console.log('  database seeded (first run)');

server.listen(PORT, () => {
  const base = `http://localhost:${PORT}`;
  console.log('');
  console.log('  抖音 App 后台服务已启动（零依赖）');
  console.log('  ─────────────────────────────────────────────');
  console.log(`  管理后台   ${base}/`);
  console.log(`  接口文档   ${base}/api/health`);
  console.log(`  账号密码   ${DEFAULT_ADMIN.username} / ${DEFAULT_ADMIN.password}`);
  console.log('  ─────────────────────────────────────────────');
  console.log(`  App 接入   EXPO_PUBLIC_API_BASE=${base}`);
  console.log('');
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log('\n  服务已停止');
    server.close(() => process.exit(0));
  });
}
